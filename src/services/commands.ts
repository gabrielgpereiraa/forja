/**
 * Camada de aplicação: comandos puros `(data, ...args) => { data, feedback }`.
 *
 * Toda regra de negócio que muda estado passa por aqui — o store apenas
 * aplica o resultado. Assim a UI fica fina, os dados de exemplo usam o mesmo
 * caminho do usuário real e tudo é testável sem React.
 */
import { addDays, nowTimestamp, startOfWeek, type ISODate } from '@/domain/date'
import { findNewlyUnlocked } from '@/domain/gamification/achievements'
import { evaluateEvent, sumResource } from '@/domain/gamification/engine'
import { getLevelInfo } from '@/domain/gamification/levels'
import type { AchievementDefinition, GameEvent, LedgerDraft, LedgerEntry } from '@/domain/models/gamification'
import type { DailyRecord, LateConfirmation } from '@/domain/models/day'
import type { Habit, HabitInput, HabitLog } from '@/domain/models/habit'
import { createId } from '@/domain/models/ids'
import type { Task, TaskInput } from '@/domain/models/task'
import { isTaskLocked } from '@/domain/rules/task-agenda'
import { buildDayOverview, createDailyRecord } from '@/domain/rules/day-overview'
import { getWeekProgress, indexLogs, isSessionComplete, sessionTargetOf } from '@/domain/rules/habit-schedule'
import { applyGoalChange, habitForDate } from '@/domain/rules/habit-goal-history'
import type { GoalProposal } from '@/domain/rules/habit-progression'
import { eligibleLateHabitIds, isWithinLateWindow, lateConfirmationCandidates } from '@/domain/rules/late-confirmation'
import { computePlayerStats } from '@/domain/rules/stats'
import { computeStreak } from '@/domain/rules/streaks'
import type { AppData } from './app-data'
import { commitSkillChanges, replaceLogPractices, type SkillFeedback } from './skill-sync'

/* ------------------------------ Feedback ------------------------------ */

export interface Feedback {
  /** XP ganho (ou perdido) pela ação. */
  xp: number
  focus: number
  events: GameEvent['type'][]
  achievements: AchievementDefinition[]
  levelUp: number | null
  record?: DailyRecord
  streak?: number
  /** Variações nas habilidades afetadas (mais relevante primeiro). */
  skills: SkillFeedback[]
}

export interface CommandResult {
  data: AppData
  feedback: Feedback
}

const emptyFeedback = (): Feedback => ({ xp: 0, focus: 0, events: [], achievements: [], levelUp: null, skills: [] })

function toEntries(drafts: LedgerDraft[]): LedgerEntry[] {
  const createdAt = nowTimestamp()
  return drafts.map((d) => ({ ...d, id: createId('lg'), createdAt }))
}

function withoutSource(ledger: LedgerEntry[], sourceKey: string): LedgerEntry[] {
  return ledger.filter((e) => e.sourceKey !== sourceKey)
}

/**
 * Pós-processamento comum: calcula variação de XP/foco, nível e conquistas
 * recém-desbloqueadas. `today` é o dia de produtividade de referência.
 */
function finalize(prev: AppData, next: AppData, today: ISODate, feedback: Feedback): CommandResult {
  const prevXp = sumResource(prev.ledger, 'xp')
  const nextXp = sumResource(next.ledger, 'xp')
  feedback.xp = nextXp - prevXp
  feedback.focus = sumResource(next.ledger, 'focus') - sumResource(prev.ledger, 'focus')
  const prevLevel = getLevelInfo(prevXp).level
  const nextLevel = getLevelInfo(nextXp).level
  if (nextLevel > prevLevel) feedback.levelUp = nextLevel

  const unlocked = unlockAchievements(next, today)
  if (unlocked.unlocked.length) {
    next = unlocked.data
    feedback.achievements = unlocked.unlocked
  }
  return { data: next, feedback }
}

/**
 * Estado consolidado: o que já não pode mais mudar. Confirmações tardias
 * ainda desfazíveis (o dia encerrado ainda é "ontem") são revertidas aqui —
 * conquistas que dependem delas aguardam a janela fechar.
 */
export function consolidatedData(data: AppData, today: ISODate): AppData {
  let next = data
  for (const record of Object.values(data.records)) {
    if (!record?.lateConfirmations?.length || !isWithinLateWindow(record.date, today)) continue
    for (const c of record.lateConfirmations) {
      const undone = applyLateConfirmation(next, c.habitId, record.date, today, false)
      if (undone) next = undone.data
    }
  }
  return next
}

/**
 * Desbloqueia (de forma definitiva) as conquistas atingidas pelos dados
 * consolidados. Conquistas já desbloqueadas nunca são removidas.
 */
export function unlockAchievements(data: AppData, today: ISODate): { data: AppData; unlocked: AchievementDefinition[] } {
  const base = consolidatedData(data, today)
  const stats = computePlayerStats({
    today,
    habits: base.habits,
    logs: base.logs,
    logIndex: indexLogs(base.logs),
    tasks: base.tasks,
    records: base.records,
    ledger: base.ledger,
  })
  const unlocked = findNewlyUnlocked(stats, new Set(Object.keys(data.achievements)))
  if (!unlocked.length) return { data, unlocked }
  const at = nowTimestamp()
  return {
    data: {
      ...data,
      achievements: { ...data.achievements, ...Object.fromEntries(unlocked.map((a) => [a.id, { id: a.id, unlockedAt: at, date: today }])) },
    },
    unlocked,
  }
}

/* ------------------------------ Perfil ------------------------------ */

export function completeOnboarding(data: AppData, name: string, today: ISODate): AppData {
  return {
    ...data,
    profile: { name: name.trim(), onboardedAt: nowTimestamp(), startDate: data.profile.startDate ?? today },
  }
}

/* ------------------------------ Hábitos ------------------------------ */

export function createHabit(data: AppData, input: HabitInput, today: ISODate): { data: AppData; habit: Habit } {
  const habit: Habit = {
    ...sanitizeHabitInput(input),
    id: createId('hb'),
    archived: false,
    startDate: today,
    createdAt: nowTimestamp(),
    order: data.habits.reduce((m, h) => Math.max(m, h.order), 0) + 1,
  }
  return { data: { ...data, habits: [...data.habits, habit] }, habit }
}

function sanitizeHabitInput(input: HabitInput): HabitInput {
  const days = input.schedule.days && input.schedule.days.length > 0 ? [...new Set(input.schedule.days)].sort() : null
  const weeklyGoal = days ? days.length : Math.min(7, Math.max(1, Math.round(input.schedule.weeklyGoal)))
  const description = input.description?.trim()
  return {
    ...input,
    name: input.name.trim(),
    ...(description ? { description } : { description: undefined }),
    schedule: { weeklyGoal, days },
    target: input.target && input.target.amount > 0 ? { ...input.target, amount: Math.round(input.target.amount) } : null,
    confirmNextDay: Boolean(input.confirmNextDay),
  }
}

/**
 * Atualiza um hábito. Mudanças de meta (frequência/meta por sessão) valem da
 * semana de `today` em diante — semanas anteriores mantêm a meta antiga.
 */
export function updateHabit(data: AppData, id: string, input: HabitInput, today: ISODate): AppData {
  return {
    ...data,
    habits: data.habits.map((h) => {
      if (h.id !== id) return h
      const clean = sanitizeHabitInput(input)
      const { schedule, target, ...rest } = clean
      return applyGoalChange({ ...h, ...rest }, schedule, target, today)
    }),
  }
}

/** Aplica uma sugestão de progressão (nova meta a partir desta semana). */
export function applyHabitGoal(data: AppData, id: string, goal: GoalProposal, today: ISODate): AppData {
  return {
    ...data,
    habits: data.habits.map((h) => {
      if (h.id !== id) return h
      const clean = sanitizeHabitInput({ ...h, schedule: goal.schedule, target: goal.target })
      const { progressionSnoozedUntil: _snooze, ...rest } = applyGoalChange(h, clean.schedule, clean.target, today)
      void _snooze
      return rest
    }),
  }
}

/** "Agora não": esconde sugestões desse hábito por 2 semanas. */
export function snoozeProgression(data: AppData, id: string, today: ISODate): AppData {
  return {
    ...data,
    habits: data.habits.map((h) => (h.id === id ? { ...h, progressionSnoozedUntil: addDays(today, 14) } : h)),
  }
}

export function setHabitArchived(data: AppData, id: string, archived: boolean): AppData {
  return { ...data, habits: data.habits.map((h) => (h.id === id ? { ...h, archived } : h)) }
}

export function deleteHabit(data: AppData, id: string, today: ISODate): AppData {
  const logIds = new Set(data.logs.filter((l) => l.habitId === id).map((l) => `habitLog:${l.id}`))
  const affected = data.skillLinks.filter((l) => l.habitId === id).map((l) => l.skillId)
  const next: AppData = {
    ...data,
    habits: data.habits.filter((h) => h.id !== id),
    logs: data.logs.filter((l) => l.habitId !== id),
    ledger: data.ledger.filter((e) => !logIds.has(e.sourceKey) && !e.sourceKey.startsWith(`weeklyGoal:${id}:`)),
    skillLinks: data.skillLinks.filter((l) => l.habitId !== id),
  }
  // Práticas geradas pelo hábito excluído saem junto (como o XP dele).
  return commitSkillChanges(next, data.skillPractices.filter((p) => p.sourceHabitId !== id), affected, today).data
}

/**
 * Define o valor registrado de um hábito em um dia (valor absoluto).
 * `0` remove o registro. Gera/reverte recompensas automaticamente.
 *
 * `today` (dia de produtividade atual) ativa a restrição de datas: só hoje
 * pode ser registrado livremente; ontem ainda aberto aceita apenas hábitos com
 * "Confirmar na manhã seguinte". Sem `today` (dados de exemplo, importação),
 * só o bloqueio de dia encerrado vale.
 */
export function setHabitValue(data: AppData, habitId: string, date: ISODate, value: number, today?: ISODate): CommandResult {
  // Dia encerrado é somente leitura (exceção controlada: `confirmLateHabit`).
  if (data.records[date]) return { data, feedback: emptyFeedback() }
  if (today && !canWriteHabitOn(data, habitId, date, today)) return { data, feedback: emptyFeedback() }
  return writeHabitValue(data, habitId, date, value, today ?? date)
}

/** Restrição de datas para registros do usuário (sem edição retroativa genérica). */
export function canWriteHabitOn(data: AppData, habitId: string, date: ISODate, today: ISODate): boolean {
  if (data.records[date]) return false
  if (date === today) return true
  // Revisão da manhã: ontem ainda aberto, só hábitos marcados para confirmar depois.
  if (date === addDays(today, -1)) return Boolean(data.habits.find((h) => h.id === habitId)?.confirmNextDay)
  return false
}

/** Grava o valor sem checar o bloqueio do dia — uso interno dos comandos. */
function writeHabitValue(data: AppData, habitId: string, date: ISODate, value: number, today: ISODate): CommandResult {
  const res = applyHabitValue(data, habitId, date, value, today)
  return res.data === data ? res : finalize(data, res.data, today, res.feedback)
}

/** Núcleo puro de `writeHabitValue` (sem conquistas). */
function applyHabitValue(data: AppData, habitId: string, date: ISODate, value: number, today: ISODate): CommandResult {
  const feedback = emptyFeedback()
  const habit = data.habits.find((h) => h.id === habitId)
  if (!habit) return { data, feedback }

  const existing = data.logs.find((l) => l.habitId === habitId && l.date === date) ?? null
  let logs = data.logs
  let ledger = data.ledger
  let current: HabitLog | null = null
  const safe = Math.max(0, Math.round(value * 100) / 100)

  if (safe === 0) {
    if (!existing) return { data, feedback }
    logs = logs.filter((l) => l.id !== existing.id)
    ledger = withoutSource(ledger, `habitLog:${existing.id}`)
  } else {
    const completed = isSessionComplete(habit, safe, date)
    const now = nowTimestamp()
    const log: HabitLog = existing
      ? { ...existing, value: safe, completed, updatedAt: now }
      : { id: createId('hl'), habitId, date, value: safe, completed, createdAt: now, updatedAt: now }
    logs = existing ? logs.map((l) => (l.id === log.id ? log : l)) : [...logs, log]
    current = log
    ledger = withoutSource(ledger, `habitLog:${log.id}`)
    // Foco do valor atual (substitui o anterior: editar não acumula).
    const h = habitForDate(habit, date)
    ledger = [...ledger, ...toEntries(evaluateEvent({ type: 'habit.progress_recorded', habit: h, log, date }))]
    if (completed) {
      // Recompensa calculada com a meta vigente naquela semana.
      const event: GameEvent = { type: 'habit.session_completed', habit: h, log, date }
      ledger = [...ledger, ...toEntries(evaluateEvent(event))]
      if (!existing?.completed) feedback.events.push(event.type)
    }
  }

  // Sincroniza a recompensa de meta semanal com o progresso real.
  const weekStart = startOfWeek(date)
  const goalKey = `weeklyGoal:${habit.id}:${weekStart}`
  const progress = getWeekProgress(habit, addDays(weekStart, 6), indexLogs(logs))
  const hasGoalEntry = ledger.some((e) => e.sourceKey === goalKey)
  if (progress.goal > 0 && progress.done >= progress.goal && !hasGoalEntry) {
    const event: GameEvent = { type: 'habit.weekly_goal_reached', habit, weekStart, date }
    ledger = [...ledger, ...toEntries(evaluateEvent(event))]
    feedback.events.push(event.type)
  } else if (progress.done < progress.goal && hasGoalEntry) {
    ledger = withoutSource(ledger, goalKey)
  }

  // Habilidades vinculadas: a quantidade registrada vira prática (ou é removida).
  let next: AppData = { ...data, logs, ledger }
  const links = data.skillLinks.filter((l) => l.habitId === habit.id)
  const logId = current?.id ?? existing?.id
  if (links.length > 0 && logId) {
    const practices = replaceLogPractices(data.skillPractices, habit, logId, current, links)
    // Recompensas de nível seguem o replay até hoje (não até a data do registro).
    const asOf = today > date ? today : date
    const res = commitSkillChanges(next, practices, links.map((l) => l.skillId), asOf, new Map(links.map((l) => [l.skillId, l.weight])))
    next = res.data
    feedback.skills = res.feedback
  }

  return { data: next, feedback }
}

/** Alterna a sessão do dia: concluída ↔ vazia. */
export function toggleHabit(data: AppData, habitId: string, date: ISODate, today?: ISODate): CommandResult {
  const habit = data.habits.find((h) => h.id === habitId)
  if (!habit) return { data, feedback: emptyFeedback() }
  const log = data.logs.find((l) => l.habitId === habitId && l.date === date)
  return setHabitValue(data, habitId, date, log?.completed ? 0 : Math.max(sessionTargetOf(habit, date), log?.value ?? 0), today)
}

/* ------------------------------ Tarefas ------------------------------ */

export function createTask(data: AppData, input: TaskInput, today: ISODate): { data: AppData; task: Task } {
  const description = input.description?.trim()
  const task: Task = {
    id: createId('tk'),
    title: input.title.trim(),
    ...(description ? { description } : {}),
    dueDate: input.dueDate,
    priority: input.priority,
    completed: false,
    completedAt: null,
    completedOn: null,
    createdAt: nowTimestamp(),
    createdOn: today,
  }
  return { data: { ...data, tasks: [task, ...data.tasks] }, task }
}

export function updateTask(data: AppData, id: string, input: TaskInput): AppData {
  const description = input.description?.trim()
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.id === id
        ? { ...t, title: input.title.trim(), description: description || undefined, dueDate: input.dueDate, priority: input.priority }
        : t,
    ),
  }
}

/**
 * Conclui/reabre uma tarefa em `date`. Dias encerrados são somente leitura:
 * não se conclui tarefa num dia encerrado nem se reabre uma concluída nele.
 * `today` (dia de produtividade atual) impede concluir em outra data.
 */
export function setTaskCompleted(data: AppData, id: string, completed: boolean, date: ISODate, today?: ISODate): CommandResult {
  const feedback = emptyFeedback()
  const task = data.tasks.find((t) => t.id === id)
  if (!task || task.completed === completed) return { data, feedback }
  if (!canChangeTask(data, task, completed, date, today)) return { data, feedback }
  const updated: Task = completed
    ? { ...task, completed: true, completedAt: nowTimestamp(), completedOn: date }
    : { ...task, completed: false, completedAt: null, completedOn: null }
  let ledger = withoutSource(data.ledger, `task:${task.id}`)
  if (completed) {
    const event: GameEvent = { type: 'task.completed', task: updated, date }
    ledger = [...ledger, ...toEntries(evaluateEvent(event))]
    feedback.events.push(event.type)
  }
  return finalize(data, { ...data, tasks: data.tasks.map((t) => (t.id === id ? updated : t)), ledger }, today ?? date, feedback)
}

/** Uma tarefa pode mudar de estado sem alterar um dia encerrado? */
export function canChangeTask(data: AppData, task: Task, completed: boolean, date: ISODate, today?: ISODate): boolean {
  if (isTaskLocked(task, data.records, date)) return false
  return !completed || !today || date === today
}

export function deleteTask(data: AppData, id: string): { data: AppData; removed: Task | null; entries: LedgerEntry[] } {
  const removed = data.tasks.find((t) => t.id === id) ?? null
  const key = `task:${id}`
  return {
    data: { ...data, tasks: data.tasks.filter((t) => t.id !== id), ledger: withoutSource(data.ledger, key) },
    removed,
    entries: data.ledger.filter((e) => e.sourceKey === key),
  }
}

export function restoreTask(data: AppData, task: Task, entries: LedgerEntry[]): AppData {
  if (data.tasks.some((t) => t.id === task.id)) return data
  return { ...data, tasks: [task, ...data.tasks], ledger: [...data.ledger, ...entries] }
}

/* ------------------------------ Dia ------------------------------ */

export function closeDay(data: AppData, date: ISODate, closedBy: DailyRecord['closedBy']): CommandResult {
  const feedback = emptyFeedback()
  if (data.records[date]) return { data, feedback }
  const overview = buildDayOverview({
    date,
    habits: data.habits,
    logs: indexLogs(data.logs),
    tasks: data.tasks,
    record: null,
  })
  const record = createDailyRecord(overview, closedBy, nowTimestamp())
  const records = { ...data.records, [date]: record }
  const { ledger, streak } = rewardDay(data.ledger, records, date)
  feedback.events.push('day.closed')
  feedback.record = record
  feedback.streak = streak
  return finalize(data, { ...data, records, ledger }, date, feedback)
}

/** (Re)gera as recompensas de encerramento de um dia a partir do registro atual. */
function rewardDay(ledger: LedgerEntry[], records: AppData['records'], date: ISODate): { ledger: LedgerEntry[]; streak: number } {
  const record = records[date]
  const rest = withoutSource(ledger, `day:${date}`)
  if (!record) return { ledger: rest, streak: 0 }
  const streak = computeStreak(records, date).current
  const event: GameEvent = { type: 'day.closed', record, streak, date }
  return { ledger: [...rest, ...toEntries(evaluateEvent(event))], streak }
}

/**
 * Confirmação tardia: na manhã seguinte, confirma (ou desfaz a confirmação de)
 * um hábito marcado como "Confirmar na manhã seguinte" de um dia já encerrado.
 * O registro fica no dia anterior e o dia é recalculado (nota, hábitos, XP,
 * sequência). O dia continua encerrado; nada além disso pode mudar.
 */
export function confirmLateHabit(data: AppData, habitId: string, date: ISODate, today: ISODate, done: boolean): CommandResult {
  const res = applyLateConfirmation(data, habitId, date, today, done)
  return res ? finalize(data, res.data, today, res.feedback) : { data, feedback: emptyFeedback() }
}

/** Núcleo puro da confirmação tardia (sem conquistas). `null` = não permitido. */
function applyLateConfirmation(data: AppData, habitId: string, date: ISODate, today: ISODate, done: boolean): CommandResult | null {
  const record = data.records[date]
  const habit = data.habits.find((h) => h.id === habitId)
  if (!record || !habit) return null
  const candidates = lateConfirmationCandidates(record, data.habits, indexLogs(data.logs), today)
  const log = data.logs.find((l) => l.habitId === habitId && l.date === date)
  const confirmations = record.lateConfirmations ?? []

  let nextConfirmations: LateConfirmation[]
  let value: number
  if (done) {
    if (!candidates.pending.includes(habitId)) return null
    const previousValue = log?.value ?? 0
    value = Math.max(sessionTargetOf(habit, date), previousValue)
    nextConfirmations = [...confirmations, { habitId, confirmedAt: nowTimestamp(), previousValue }]
  } else {
    const entry = confirmations.find((c) => c.habitId === habitId)
    if (!entry || !candidates.confirmed.includes(habitId)) return null
    value = entry.previousValue
    nextConfirmations = confirmations.filter((c) => c.habitId !== habitId)
  }

  const written = applyHabitValue(data, habitId, date, value, today)
  let next = written.data
  const overview = buildDayOverview({ date, habits: next.habits, logs: indexLogs(next.logs), tasks: next.tasks, record: null })
  const rescored: DailyRecord = {
    ...createDailyRecord(overview, record.closedBy, record.closedAt),
    // A lista de elegíveis fica congelada como estava no encerramento.
    awaitingConfirmation: eligibleLateHabitIds(record, data.habits),
    ...(nextConfirmations.length ? { lateConfirmations: nextConfirmations } : {}),
  }
  const records = { ...next.records, [date]: rescored }
  let { ledger } = rewardDay(next.ledger, records, date)
  // Se hoje já foi encerrado, sua sequência depende de ontem: recalcula também.
  if (records[today]) ledger = rewardDay(ledger, records, today).ledger
  next = { ...next, records, ledger }

  const feedback = written.feedback
  feedback.record = rescored
  feedback.streak = computeStreak(records, today).current
  return { data: next, feedback }
}

export function reopenDay(data: AppData, date: ISODate): AppData {
  if (!data.records[date]) return data
  const records = { ...data.records }
  delete records[date]
  return { ...data, records, ledger: withoutSource(data.ledger, `day:${date}`) }
}

/**
 * Ontem fica aberto para a revisão da manhã (confirmar o que só dá para saber
 * depois, como "dormi até 23h") — exceto se não havia nada planejado.
 */
export function isPendingReview(data: AppData, date: ISODate, today: ISODate): boolean {
  const start = data.profile.startDate
  if (!start || date !== addDays(today, -1) || date < start || data.records[date]) return false
  const overview = buildDayOverview({ date, habits: data.habits, logs: indexLogs(data.logs), tasks: data.tasks, record: null })
  return overview.phase !== 'empty'
}

/**
 * Encerra automaticamente dias passados que ficaram abertos (o app não foi
 * aberto, ou o usuário esqueceu). Mantém o histórico contínuo e honesto.
 * Ontem só é encerrado aqui se estiver vazio; caso contrário aguarda a
 * revisão da manhã até o fim de hoje.
 */
export function autoCloseMissedDays(data: AppData, today: ISODate, maxDays = 60): AppData {
  const start = data.profile.startDate
  if (!start) return data
  let from = addDays(today, -maxDays)
  if (from < start) from = start
  const yesterday = addDays(today, -1)
  let next = data
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (next.records[d]) continue
    if (d === yesterday && isPendingReview(next, d, today)) continue
    next = closeDay(next, d, 'auto').data
  }
  // Conquistas que aguardavam a consolidação (ex.: confirmações tardias de
  // anteontem) são validadas ao abrir o app.
  return unlockAchievements(next, today).data
}
