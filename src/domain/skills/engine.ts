/**
 * Motor de habilidades — regras puras e determinísticas.
 *
 * O estado de uma habilidade é obtido *reproduzindo* suas práticas dia a dia,
 * do início até a data pedida (`asOf`). Não há job diário nem estado mutável:
 * abrir o app depois de 3 semanas produz exatamente o mesmo resultado que tê-lo
 * aberto todos os dias. A mesma reprodução gera o histórico diário (gráficos).
 *
 * Em cada dia:
 *   - com prática  → ganha XP, recupera/afia condição, pode consolidar maestria;
 *   - sem prática  → pode enferrujar (condição cai), se estiver abaixo da
 *                    manutenção e fora do período de tolerância;
 *   - hoje sem prática ainda não enferruja (o dia não acabou).
 * Nível e maestria nunca diminuem. A condição nunca fica abaixo do piso.
 */
import { addDays, diffDays, type ISODate } from '../date'
import type { Skill, SkillPractice, SkillStatus } from '../models/skill'
import { clamp } from '../../lib/utils'
import { SKILL_CONFIG, type SkillConfig } from './config'

/* ------------------------------------------------------------------ */
/*  Funções elementares (cada regra isolada e testável)               */
/* ------------------------------------------------------------------ */

type EffortFields = Pick<SkillPractice, 'duration' | 'intensity' | 'weight'> & Partial<Pick<SkillPractice, 'rulesVersion' | 'targetMinutes' | 'sourceHabitId'>>

/**
 * Esforço de uma prática em "sessões equivalentes" (já ponderado pelo peso do hábito).
 * v2 com meta em minutos: proporção = mín(1, minutos ÷ meta) × peso.
 * Demais (v1, avulsas, metas que não são tempo): regra original.
 */
export function practiceEffort(practice: EffortFields, skill: Pick<Skill, 'sessionMinutes'>, cfg: SkillConfig = SKILL_CONFIG): number {
  if (practice.rulesVersion === 2 && practice.targetMinutes && practice.duration !== null && practice.duration > 0) {
    return Math.min(1, practice.duration / practice.targetMinutes) * practice.weight
  }
  const raw = practice.duration !== null && practice.duration > 0 ? practice.duration / Math.max(1, skill.sessionMinutes) : practice.intensity
  return clamp(raw, cfg.MIN_PRACTICE_EFFORT, cfg.MAX_PRACTICE_EFFORT) * practice.weight
}

/** Minutos mínimos para uma prática contar na manutenção (nunca acima da própria meta). */
export function maintenanceMinimum(targetMinutes: number, cfg: SkillConfig = SKILL_CONFIG): number {
  return Math.min(targetMinutes, Math.max(cfg.MAINTENANCE_MIN_MINUTES, Math.ceil(targetMinutes * cfg.MAINTENANCE_MIN_RATIO - 1e-9)))
}

/**
 * A prática conta como sessão de manutenção? Independe do peso do vínculo.
 * v1 e avulsas: sempre. v2 em minutos: atingir o mínimo. v2 binária ou com
 * outra unidade: só quando a sessão foi concluída.
 */
export function isMaintenancePractice(practice: EffortFields, cfg: SkillConfig = SKILL_CONFIG): boolean {
  if (practice.rulesVersion !== 2 || !practice.sourceHabitId) return true
  if (practice.targetMinutes && practice.duration !== null) return practice.duration >= maintenanceMinimum(practice.targetMinutes, cfg) - 1e-9
  return practice.intensity >= 1 - 1e-9
}

/** XP total necessário para alcançar `level`. */
export function xpForLevel(level: number, cfg: SkillConfig = SKILL_CONFIG): number {
  return level <= 1 ? 0 : cfg.LEVEL_XP_BASE * Math.pow(level - 1, cfg.LEVEL_XP_EXPONENT)
}

export interface SkillLevelInfo {
  level: number
  /** XP dentro do nível atual. */
  current: number
  /** XP do nível atual até o próximo. */
  required: number
  progress: number
}

export function calculateLevel(experience: number, cfg: SkillConfig = SKILL_CONFIG): SkillLevelInfo {
  let level = 1
  while (xpForLevel(level + 1, cfg) <= experience) level++
  const base = xpForLevel(level, cfg)
  const required = xpForLevel(level + 1, cfg) - base
  return { level, current: experience - base, required, progress: (experience - base) / required }
}

/** Taxa base da fase de inatividade (pontos/dia) para `daysSinceLast`. */
export function inactivityRate(daysSinceLast: number, cfg: SkillConfig = SKILL_CONFIG): number {
  if (daysSinceLast <= cfg.DECAY_GRACE_PERIOD) return 0
  let rate = 0
  for (const phase of cfg.DECAY_PHASES) if (daysSinceLast >= phase.fromDay) rate = phase.rate
  return rate
}

export interface DecayInput {
  daysSinceLast: number
  condition: number
  mastery: number
  level: number
  maintenancePerWeek: number
  minimumCondition: number
  /** Sessões na janela de manutenção (dias recentes). */
  sessionsInWindow: number
}

export interface DecayBreakdown {
  amount: number
  inactivityRate: number
  maintenanceFactor: number
  masteryResistance: number
  levelResistance: number
  floorProximity: number
}

/**
 * Ferrugem de um dia:
 *   taxa da fase × fator de manutenção × resistência da maestria
 *   × resistência do nível × proximidade do piso
 * Zero dentro da tolerância ou quando a manutenção está em dia.
 */
export function calculateSkillDecay(input: DecayInput, cfg: SkillConfig = SKILL_CONFIG): DecayBreakdown {
  const rate = inactivityRate(input.daysSinceLast, cfg)
  const maintenanceFactor = Math.pow(Math.max(0.5, input.maintenancePerWeek) / cfg.REFERENCE_MAINTENANCE, cfg.MAINTENANCE_DECAY_EXPONENT)
  const masteryResistance = 1 - cfg.MASTERY_DECAY_RESISTANCE * clamp(input.mastery / cfg.MAX_MASTERY, 0, 1)
  const levelResistance = 1 / (1 + cfg.LEVEL_DECAY_RESISTANCE * Math.max(0, input.level - 1))
  const span = cfg.MAX_CONDITION - input.minimumCondition
  const position = span > 0 ? clamp((input.condition - input.minimumCondition) / span, 0, 1) : 0
  const floorProximity = cfg.FLOOR_PROXIMITY_MIN_FACTOR + (1 - cfg.FLOOR_PROXIMITY_MIN_FACTOR) * position

  const maintained = input.sessionsInWindow >= input.maintenancePerWeek
  const raw = maintained ? 0 : rate * maintenanceFactor * masteryResistance * levelResistance * floorProximity
  const amount = Math.max(0, Math.min(raw, input.condition - input.minimumCondition))
  return { amount, inactivityRate: maintained ? 0 : rate, maintenanceFactor, masteryResistance, levelResistance, floorProximity }
}

/**
 * Condição recuperada/afiada por uma prática. A maestria acelera a
 * recuperação ("memória muscular"); perto de 100% o ganho diminui.
 */
export function calculateRecovery(
  input: { condition: number; mastery: number; effort: number },
  cfg: SkillConfig = SKILL_CONFIG,
): number {
  const memory = 1 + cfg.RECOVERY_MULTIPLIER * clamp(input.mastery / cfg.MAX_MASTERY, 0, 1)
  const room = cfg.MAX_CONDITION - input.condition
  const taper = clamp(room / cfg.CONDITION_TAPER_RANGE, cfg.CONDITION_TAPER_MIN, 1)
  const gain = cfg.BASE_CONDITION_GAIN * input.effort * memory * taper
  return Math.max(0, Math.min(gain, room))
}

/** XP de uma prática. Praticar enferrujado rende um pouco menos (parte vai para recuperar). */
export function calculateXpGain(
  input: { effort: number; condition: number; minimumCondition: number },
  cfg: SkillConfig = SKILL_CONFIG,
): number {
  const span = cfg.MAX_CONDITION - input.minimumCondition
  const sharpness = span > 0 ? clamp((input.condition - input.minimumCondition) / span, 0, 1) : 1
  const factor = cfg.XP_RUSTY_FACTOR_MIN + (1 - cfg.XP_RUSTY_FACTOR_MIN) * sharpness
  return cfg.XP_PER_PRACTICE * input.effort * factor
}

/**
 * Maestria: só consolida com a habilidade afiada e a prática consistente;
 * retornos decrescentes (quanto mais alta, mais lenta).
 */
export function calculateMasteryGain(
  input: { mastery: number; condition: number; effort: number; sessionsInWindow: number; maintenancePerWeek: number },
  cfg: SkillConfig = SKILL_CONFIG,
): number {
  if (input.condition < cfg.MASTERY_CONDITION_THRESHOLD) return 0
  if (cfg.MASTERY_REQUIRES_MAINTENANCE && input.sessionsInWindow < input.maintenancePerWeek) return 0
  const remaining = 1 - clamp(input.mastery / cfg.MAX_MASTERY, 0, 1)
  return cfg.MASTERY_GAIN_PER_PRACTICE * Math.min(input.effort, 1) * remaining
}

/* ------------------------------------------------------------------ */
/*  Reprodução (replay)                                               */
/* ------------------------------------------------------------------ */

export interface SkillDay {
  date: ISODate
  /** Esforço praticado no dia (sessões equivalentes). */
  effort: number
  minutes: number
  conditionGain: number
  decay: number
  xpGain: number
  masteryGain: number
  condition: number
  experience: number
  level: number
  mastery: number
  sessionsInWindow: number
}

export interface SkillProgress {
  condition: number
  experience: number
  mastery: number
  level: number
}

export interface SkillSnapshot extends SkillProgress {
  skillId: string
  asOf: ISODate
  levelInfo: SkillLevelInfo
  minimumCondition: number
  maintenancePerWeek: number
  status: SkillStatus
  /** Sessões nos últimos N dias (janela de manutenção, incluindo hoje). */
  sessionsInWindow: number
  lastPracticedOn: ISODate | null
  /** Dias desde a última prática (qualquer uma). */
  daysSinceLast: number | null
  /** Última prática válida para manutenção. */
  lastValidPracticeOn: ISODate | null
  /** Dias contados para a ferrugem (desde a última prática válida). */
  daysSinceValid: number | null
  /** Dias até começar a enferrujar, se nada for feito (só quando abaixo da manutenção). */
  daysUntilRust: number | null
  /** Quanto enferrujaria amanhã sem prática (0 se não). */
  nextDecay: number
  /** Ferrugem acumulada desde o último pico de condição. */
  rustSincePeak: number
  totalMinutes: number
  totalPractices: number
  history: SkillDay[]
}

interface ReplayContext {
  skill: Pick<Skill, 'id' | 'maintenancePerWeek' | 'sessionMinutes' | 'minimumCondition' | 'startDate'>
  cfg: SkillConfig
}

function floorOf(skill: ReplayContext['skill'], cfg: SkillConfig): number {
  return clamp(skill.minimumCondition ?? cfg.MINIMUM_CONDITION, 0, cfg.MAX_CONDITION)
}

/**
 * Esforço e minutos por dia (práticas até `asOf`), com teto diário, e os dias
 * com ao menos uma prática válida para manutenção (no máximo 1 crédito por dia,
 * independente do peso; práticas abaixo do mínimo não se somam).
 */
function dailyEfforts(ctx: ReplayContext, practices: readonly SkillPractice[], asOf: ISODate) {
  const efforts = new Map<ISODate, number>()
  const minutes = new Map<ISODate, number>()
  const validDays = new Set<ISODate>()
  let totalPractices = 0
  for (const p of practices) {
    if (p.skillId !== ctx.skill.id || p.date > asOf) continue
    totalPractices++
    efforts.set(p.date, (efforts.get(p.date) ?? 0) + practiceEffort(p, ctx.skill, ctx.cfg))
    if (p.duration) minutes.set(p.date, (minutes.get(p.date) ?? 0) + p.duration * p.weight)
    if (isMaintenancePractice(p, ctx.cfg)) validDays.add(p.date)
  }
  for (const [d, e] of efforts) efforts.set(d, Math.min(e, ctx.cfg.MAX_DAILY_EFFORT))
  return { efforts, minutes, validDays, totalPractices }
}

/** Aplica um dia com prática ao estado (pura). */
export function applyPractice(
  state: SkillProgress,
  input: { effort: number; sessionsInWindow: number; maintenancePerWeek: number; minimumCondition: number },
  cfg: SkillConfig = SKILL_CONFIG,
): SkillProgress & { conditionGain: number; xpGain: number; masteryGain: number } {
  const xpGain = calculateXpGain({ effort: input.effort, condition: state.condition, minimumCondition: input.minimumCondition }, cfg)
  const conditionGain = calculateRecovery({ condition: state.condition, mastery: state.mastery, effort: input.effort }, cfg)
  const condition = state.condition + conditionGain
  const experience = state.experience + xpGain
  const masteryGain = calculateMasteryGain(
    { mastery: state.mastery, condition, effort: input.effort, sessionsInWindow: input.sessionsInWindow, maintenancePerWeek: input.maintenancePerWeek },
    cfg,
  )
  return {
    condition,
    experience,
    mastery: Math.min(cfg.MAX_MASTERY, state.mastery + masteryGain),
    level: calculateLevel(experience, cfg).level,
    conditionGain,
    xpGain,
    masteryGain,
  }
}

/** Estado derivado (nunca armazenado). */
export function calculateSkillState(
  input: { lastPracticedOn: ISODate | null; asOf: ISODate; sessionsInWindow: number; maintenancePerWeek: number },
  cfg: SkillConfig = SKILL_CONFIG,
): { status: SkillStatus; daysSinceLast: number | null; daysUntilRust: number | null } {
  if (!input.lastPracticedOn) return { status: 'new', daysSinceLast: null, daysUntilRust: null }
  const daysSinceLast = diffDays(input.lastPracticedOn, input.asOf)
  const eps = 1e-9
  if (input.sessionsInWindow > input.maintenancePerWeek + eps) return { status: 'evolving', daysSinceLast, daysUntilRust: null }
  if (input.sessionsInWindow >= input.maintenancePerWeek - eps) return { status: 'maintaining', daysSinceLast, daysUntilRust: null }
  // Abaixo da manutenção: dentro da tolerância ainda está "mantendo".
  if (daysSinceLast <= cfg.DECAY_GRACE_PERIOD) {
    return { status: 'maintaining', daysSinceLast, daysUntilRust: cfg.DECAY_GRACE_PERIOD - daysSinceLast + 1 }
  }
  return { status: 'rusting', daysSinceLast, daysUntilRust: 0 }
}

/**
 * Projeção completa de uma habilidade em `asOf`. Determinística: mesmos dados
 * → mesmo resultado, independentemente de quando/quantas vezes é chamada.
 */
export function replaySkill(
  skill: ReplayContext['skill'],
  practices: readonly SkillPractice[],
  asOf: ISODate,
  cfg: SkillConfig = SKILL_CONFIG,
): SkillSnapshot {
  const ctx: ReplayContext = { skill, cfg }
  const floor = floorOf(skill, cfg)
  const { efforts, minutes, validDays, totalPractices } = dailyEfforts(ctx, practices, asOf)
  const firstPractice = [...efforts.keys()].sort()[0]
  const start = firstPractice && firstPractice < skill.startDate ? firstPractice : skill.startDate

  let state: SkillProgress = { condition: Math.max(floor, cfg.INITIAL_CONDITION), experience: 0, mastery: 0, level: 1 }
  let lastPracticedOn: ISODate | null = null
  /**
   * Referência da inatividade (ferrugem): última prática válida. Práticas
   * abaixo do mínimo evoluem a habilidade, mas não zeram essa contagem; sem
   * nenhuma válida ainda, conta-se desde a primeira prática.
   */
  let rustRef: ISODate | null = null
  let peak = state.condition
  let totalMinutes = 0
  const window: number[] = []
  const history: SkillDay[] = []

  for (let d = start; d <= asOf; d = addDays(d, 1)) {
    const effort = efforts.get(d) ?? 0
    const valid = validDays.has(d)
    window.push(valid ? cfg.MAX_DAILY_SESSIONS : 0)
    if (window.length > cfg.MAINTENANCE_WINDOW_DAYS) window.shift()
    const sessionsInWindow = window.reduce((a, b) => a + b, 0)
    let conditionGain = 0
    let xpGain = 0
    let masteryGain = 0

    if (effort > 0) {
      const next = applyPractice(state, { effort, sessionsInWindow, maintenancePerWeek: skill.maintenancePerWeek, minimumCondition: floor }, cfg)
      state = { condition: next.condition, experience: next.experience, mastery: next.mastery, level: next.level }
      lastPracticedOn = d
      if (!rustRef) rustRef = d
      totalMinutes += minutes.get(d) ?? 0
      ;({ conditionGain, xpGain, masteryGain } = next)
      peak = Math.max(peak, state.condition)
    }
    if (valid) rustRef = d

    let decay = 0
    // Nunca praticada não enferruja; e o dia de hoje só conta quando terminar.
    if (!valid && rustRef && d < asOf) {
      decay = calculateSkillDecay(
        {
          daysSinceLast: diffDays(rustRef, d),
          condition: state.condition,
          mastery: state.mastery,
          level: state.level,
          maintenancePerWeek: skill.maintenancePerWeek,
          minimumCondition: floor,
          sessionsInWindow,
        },
        cfg,
      ).amount
      state = { ...state, condition: state.condition - decay }
    }
    const day: Omit<SkillDay, 'condition' | 'experience' | 'level' | 'mastery'> = {
      date: d,
      effort,
      minutes: minutes.get(d) ?? 0,
      conditionGain,
      decay,
      xpGain,
      masteryGain,
      sessionsInWindow,
    }
    history.push({ ...day, condition: state.condition, experience: state.experience, level: state.level, mastery: state.mastery })
    if (history.length > cfg.HISTORY_DAYS) history.shift()
  }

  const sessionsInWindow = window.reduce((a, b) => a + b, 0)
  const derived = calculateSkillState({ lastPracticedOn: rustRef, asOf, sessionsInWindow, maintenancePerWeek: skill.maintenancePerWeek }, cfg)

  // Projeção de amanhã sem prática (para avisar antes de enferrujar).
  let nextDecay = 0
  if (rustRef) {
    const tomorrowWindow = [...window, 0].slice(-cfg.MAINTENANCE_WINDOW_DAYS)
    nextDecay = calculateSkillDecay(
      {
        daysSinceLast: diffDays(rustRef, addDays(asOf, 1)),
        condition: state.condition,
        mastery: state.mastery,
        level: state.level,
        maintenancePerWeek: skill.maintenancePerWeek,
        minimumCondition: floor,
        sessionsInWindow: tomorrowWindow.reduce((a, b) => a + b, 0),
      },
      cfg,
    ).amount
  }

  return {
    skillId: skill.id,
    asOf,
    ...state,
    levelInfo: calculateLevel(state.experience, cfg),
    minimumCondition: floor,
    maintenancePerWeek: skill.maintenancePerWeek,
    status: derived.status,
    sessionsInWindow,
    lastPracticedOn,
    daysSinceLast: lastPracticedOn ? diffDays(lastPracticedOn, asOf) : null,
    lastValidPracticeOn: rustRef && validDays.has(rustRef) ? rustRef : null,
    daysSinceValid: derived.daysSinceLast,
    daysUntilRust: derived.daysUntilRust,
    nextDecay,
    rustSincePeak: Math.max(0, peak - state.condition),
    totalMinutes,
    totalPractices,
    history,
  }
}

/** Atalho: condição atual em `asOf`. */
export function calculateSkillCondition(
  skill: ReplayContext['skill'],
  practices: readonly SkillPractice[],
  asOf: ISODate,
  cfg: SkillConfig = SKILL_CONFIG,
): number {
  return replaySkill(skill, practices, asOf, cfg).condition
}

/** Atalho: nível/experiência atuais. */
export function calculateSkillProgress(
  skill: ReplayContext['skill'],
  practices: readonly SkillPractice[],
  asOf: ISODate,
  cfg: SkillConfig = SKILL_CONFIG,
): SkillLevelInfo & { experience: number } {
  const s = replaySkill(skill, practices, asOf, cfg)
  return { ...s.levelInfo, experience: s.experience }
}

/* ------------------------------------------------------------------ */
/*  Variações (feedback)                                              */
/* ------------------------------------------------------------------ */

export interface SkillDelta {
  skillId: string
  conditionBefore: number
  conditionAfter: number
  xpGained: number
  levelBefore: number
  levelAfter: number
  masteryBefore: number
  masteryAfter: number
  statusBefore: SkillStatus
  statusAfter: SkillStatus
  /** A prática recuperou condição perdida (estava enferrujada). */
  recovering: boolean
}

export function diffSnapshots(before: SkillSnapshot, after: SkillSnapshot): SkillDelta {
  return {
    skillId: after.skillId,
    conditionBefore: before.condition,
    conditionAfter: after.condition,
    xpGained: after.experience - before.experience,
    levelBefore: before.level,
    levelAfter: after.level,
    masteryBefore: before.mastery,
    masteryAfter: after.mastery,
    statusBefore: before.status,
    statusAfter: after.status,
    recovering: before.status === 'rusting' || before.rustSincePeak >= 3,
  }
}

/** Condição no fim de cada uma das últimas `weeks` semanas (para tendências ↑ → ↓). */
export function weeklyTrend(history: readonly SkillDay[], weeks = 8): { date: ISODate; condition: number; direction: 'up' | 'flat' | 'down' }[] {
  if (history.length === 0) return []
  const out: { date: ISODate; condition: number; direction: 'up' | 'flat' | 'down' }[] = []
  for (let i = history.length - 1; i >= 0 && out.length < weeks + 1; i -= 7) out.unshift({ date: history[i]!.date, condition: history[i]!.condition, direction: 'flat' })
  for (let i = 1; i < out.length; i++) {
    const delta = out[i]!.condition - out[i - 1]!.condition
    out[i]!.direction = delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat'
  }
  return out.slice(-weeks)
}
