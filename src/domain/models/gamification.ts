/**
 * Modelo de gamificação.
 *
 * Princípio central: toda recompensa é um lançamento em um *ledger*
 * (livro-razão) de recursos. XP, pontos, moedas, "minutos de música" etc. são
 * apenas `ResourceId`s diferentes. Regras transformam eventos de domínio em
 * lançamentos. Isso permite adicionar novos recursos, bônus, penalidades,
 * conversões e lojas sem alterar hábitos/tarefas.
 */
import type { ISODate, Timestamp } from '../date'
import type { DailyRecord } from './day'
import type { Habit, HabitLog } from './habit'
import type { AttributeId } from './attributes'
import type { ID } from './ids'
import type { Skill, SkillPractice } from './skill'
import type { Task } from './task'

/** Recursos conhecidos + extensível com qualquer string. */
export type ResourceId = 'xp' | 'focus' | (string & {})

export interface ResourceDefinition {
  id: ResourceId
  label: string
  shortLabel: string
  description: string
}

export interface LedgerEntry {
  id: ID
  resource: ResourceId
  /** Positivo = ganho, negativo = gasto/penalidade. */
  amount: number
  /** Texto curto explicando o lançamento ("Hábito concluído"). */
  reason: string
  ruleId: string
  /**
   * Chave da origem. Permite reverter lançamentos quando a ação é desfeita
   * (ex.: desmarcar hábito remove tudo com `habitLog:<id>`).
   */
  sourceKey: string
  date: ISODate
  attribute?: AttributeId
  createdAt: Timestamp
}

export type LedgerDraft = Omit<LedgerEntry, 'id' | 'createdAt'>

/* ------------------------------ Eventos ------------------------------ */

export type GameEvent =
  | { type: 'habit.session_completed'; habit: Habit; log: HabitLog; date: ISODate }
  /** Registro com valor > 0 (parcial ou concluído) — base do Foco. */
  | { type: 'habit.progress_recorded'; habit: Habit; log: HabitLog; date: ISODate }
  | { type: 'habit.weekly_goal_reached'; habit: Habit; weekStart: ISODate; date: ISODate }
  | { type: 'task.completed'; task: Task; date: ISODate }
  | { type: 'day.closed'; record: DailyRecord; streak: number; date: ISODate }
  /** Gancho para recompensas futuras ("1 min de guitarra = 1 min de música"). */
  | { type: 'skill.practiced'; skill: Skill; practice: SkillPractice; date: ISODate }
  | { type: 'skill.level_up'; skill: Skill; level: number; date: ISODate }

export type GameEventType = GameEvent['type']
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>

/**
 * Regra de recompensa declarativa. `compute` devolve a quantidade (ou `null`
 * para não lançar nada). Regras futuras (multiplicadores, penalidades,
 * conversões tempo→recompensa) seguem o mesmo contrato.
 */
export interface RewardRule<T extends GameEventType = GameEventType> {
  id: string
  event: T
  resource: ResourceId
  label: string
  /** Descrição legível para a tela "Como ganho XP?". */
  description: string
  compute: (event: GameEventOf<T>) => number | null
  attribute?: (event: GameEventOf<T>) => AttributeId | undefined
  /** Sufixo para a chave de origem (padrão: chave do evento). */
  sourceKey: (event: GameEventOf<T>) => string
}

/* --------------------------- Progressão --------------------------- */

export interface LevelInfo {
  level: number
  title: string
  totalXp: number
  /** XP acumulado dentro do nível atual. */
  currentXp: number
  /** XP necessário para o próximo nível (dentro do nível). */
  requiredXp: number
  progress: number
}

/** Estatísticas agregadas usadas por conquistas, missões e regras futuras. */
export interface PlayerStats {
  totalXp: number
  level: number
  habitSessions: number
  tasksCompleted: number
  daysClosed: number
  currentStreak: number
  bestStreak: number
  bestScore: number
  excellentDays: number
  weeklyGoalsMet: number
  totalFocusMinutes: number
}

export type AchievementTier = 'bronze' | 'silver' | 'gold'

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  tier: AchievementTier
  /** Progresso atual/alvo — define desbloqueio e permite barra de progresso. */
  progress: (stats: PlayerStats) => { current: number; target: number }
}

export interface UnlockedAchievement {
  id: string
  unlockedAt: Timestamp
  date: ISODate
}

/* ------------------- Preparação: recompensas e loja ------------------- */

/** Item resgatável futuro ("30 min de série" por 300 pontos de foco). */
export interface RewardDefinition {
  id: ID
  title: string
  description?: string
  cost: { resource: ResourceId; amount: number }[]
  repeatable: boolean
}

/** Conversão futura entre recursos ("1 min de guitarra = 1 min de música"). */
export interface ConversionRule {
  id: string
  from: { resource: ResourceId; amount: number }
  to: { resource: ResourceId; amount: number }
}
