/**
 * Regras de agenda de hábitos.
 *
 * Um hábito tem uma meta semanal (ex.: 4x). Para dizer o que "deveria" ser
 * feito hoje, calculamos o ritmo esperado: quantas sessões deveriam estar
 * concluídas até o fim de cada dia. Para hábitos flexíveis, a meta é
 * distribuída uniformemente na semana; para dias fixos, conta-se os dias
 * escolhidos. Isso gera estados claros: obrigatório hoje, opcional
 * (adiantado), atrasado, em risco, meta batida e meta excedida.
 */
import { addDays, mondayIndex, startOfWeek, weekDates, weekdayOf, type ISODate } from '../date'
import type { Habit, HabitLog } from '../models/habit'
import { habitForDate } from './habit-goal-history'

export type HabitRequirement =
  /** Precisa ser feito hoje para manter o ritmo. */
  | 'required'
  /** Está adiantado — fazer hoje é bônus. */
  | 'optional'
  /** Meta semanal já cumprida antes de hoje. */
  | 'goal_met'

export type HabitPace = 'on_track' | 'ahead' | 'behind' | 'at_risk' | 'met' | 'exceeded'

export interface HabitWeekProgress {
  weekStart: ISODate
  /** Sessões concluídas na semana (inclui hoje). */
  done: number
  /** Sessões concluídas antes de `date`. */
  doneBefore: number
  /** Meta efetiva (ajustada se o hábito começou no meio da semana). */
  goal: number
  expectedByToday: number
  expectedByYesterday: number
  /** Dias restantes na semana, incluindo hoje. */
  daysLeft: number
}

export interface HabitDayState {
  habit: Habit
  date: ISODate
  log: HabitLog | null
  doneToday: boolean
  /** Valor registrado hoje (minutos, páginas…). */
  value: number
  /** Meta por sessão (1 quando o hábito não tem meta numérica). */
  sessionTarget: number
  /** Progresso da sessão de hoje (0–1). */
  sessionProgress: number
  requirement: HabitRequirement
  pace: HabitPace
  week: HabitWeekProgress
}

export function isHabitActiveOn(habit: Habit, date: ISODate): boolean {
  return !habit.archived && date >= habit.startDate
}

/** Dia fixo ou, para hábitos flexíveis, qualquer dia. */
export function isPlannedWeekday(habit: Habit, date: ISODate): boolean {
  const days = habitForDate(habit, date).schedule.days
  return days === null || days.length === 0 || days.includes(weekdayOf(date))
}

/** Meta por sessão vigente em `date` (1 quando o hábito não tem meta numérica). */
export function sessionTargetOf(habit: Habit, date?: ISODate): number {
  const h = date ? habitForDate(habit, date) : habit
  return h.target?.amount ?? 1
}

export function isSessionComplete(habit: Habit, value: number, date?: ISODate): boolean {
  return value >= sessionTargetOf(habit, date)
}

/** Índice (0 = seg) do primeiro dia válido do hábito naquela semana. */
function firstActiveIndex(habit: Habit, weekStart: ISODate): number {
  if (habit.startDate <= weekStart) return 0
  const idx = mondayIndex(habit.startDate)
  return startOfWeek(habit.startDate) === weekStart ? idx : 7
}

export function effectiveWeeklyGoal(input: Habit, weekStart: ISODate): number {
  const habit = habitForDate(input, weekStart)
  const first = firstActiveIndex(habit, weekStart)
  if (first >= 7) return 0
  const days = habit.schedule.days
  if (days && days.length > 0) {
    const planned = days.filter((d) => mondayIndex(d) >= first).length
    return Math.min(habit.schedule.weeklyGoal, planned)
  }
  return Math.min(habit.schedule.weeklyGoal, 7 - first)
}

/** Sessões que deveriam estar concluídas até o fim do dia de índice `idx` (0 = seg). */
export function expectedSessionsBy(input: Habit, weekStart: ISODate, idx: number): number {
  if (idx < 0) return 0
  const habit = habitForDate(input, weekStart)
  const first = firstActiveIndex(habit, weekStart)
  if (idx < first) return 0
  const goal = effectiveWeeklyGoal(habit, weekStart)
  const days = habit.schedule.days
  if (days && days.length > 0) {
    const planned = days.filter((d) => {
      const i = mondayIndex(d)
      return i >= first && i <= idx
    }).length
    return Math.min(goal, planned)
  }
  const span = 7 - first
  const elapsed = Math.min(idx, 6) - first + 1
  return Math.min(goal, Math.ceil((goal * elapsed) / span - 1e-9))
}

export type LogIndex = ReadonlyMap<string, HabitLog>

export const logKey = (habitId: string, date: ISODate) => `${habitId}|${date}`

export function indexLogs(logs: readonly HabitLog[]): Map<string, HabitLog> {
  const map = new Map<string, HabitLog>()
  for (const log of logs) map.set(logKey(log.habitId, log.date), log)
  return map
}

export function getWeekProgress(habit: Habit, date: ISODate, logs: LogIndex): HabitWeekProgress {
  const weekStart = startOfWeek(date)
  const idx = mondayIndex(date)
  let done = 0
  let doneBefore = 0
  for (const d of weekDates(weekStart)) {
    const log = logs.get(logKey(habit.id, d))
    if (!log?.completed) continue
    if (d <= date) done++
    if (d < date) doneBefore++
  }
  // Sessões em dias futuros da semana não existem normalmente, mas se
  // existirem (ex.: dados importados) são ignoradas no ritmo.
  return {
    weekStart,
    done,
    doneBefore,
    goal: effectiveWeeklyGoal(habit, weekStart),
    expectedByToday: expectedSessionsBy(habit, weekStart, idx),
    expectedByYesterday: expectedSessionsBy(habit, weekStart, idx - 1),
    daysLeft: 7 - idx,
  }
}

export function getHabitDayState(input: Habit, date: ISODate, logs: LogIndex): HabitDayState {
  // Usa a meta que valia naquela semana (histórico de metas).
  const habit = habitForDate(input, date)
  const log = logs.get(logKey(habit.id, date)) ?? null
  const week = getWeekProgress(habit, date, logs)
  const target = sessionTargetOf(habit)
  const value = log?.value ?? 0
  const doneToday = log?.completed ?? false

  let requirement: HabitRequirement
  if (week.goal > 0 && week.doneBefore >= week.goal) requirement = 'goal_met'
  // Dias fixos: só é obrigatório nos dias escolhidos (recuperar em outro dia é bônus).
  else if (week.doneBefore < week.expectedByToday && isPlannedWeekday(habit, date)) requirement = 'required'
  else requirement = 'optional'

  let pace: HabitPace
  const remainingNeeded = week.goal - week.doneBefore
  if (week.goal > 0 && week.done > week.goal) pace = 'exceeded'
  else if (week.goal > 0 && week.done >= week.goal) pace = 'met'
  else if (remainingNeeded > week.daysLeft) pace = 'at_risk'
  else if (week.doneBefore < week.expectedByYesterday) pace = 'behind'
  else if (week.done > week.expectedByToday) pace = 'ahead'
  else pace = 'on_track'

  return {
    habit,
    date,
    log,
    doneToday,
    value,
    sessionTarget: target,
    sessionProgress: Math.min(1, value / target),
    requirement,
    pace,
    week,
  }
}

export function getHabitsForDay(habits: readonly Habit[], date: ISODate, logs: LogIndex): HabitDayState[] {
  return habits
    .filter((h) => isHabitActiveOn(h, date))
    .sort((a, b) => a.order - b.order)
    .map((h) => getHabitDayState(h, date, logs))
}

/** Hábitos que entram no cálculo do dia (obrigatórios + os que foram feitos). */
export function isCountedForDay(state: HabitDayState): boolean {
  return state.requirement === 'required'
}

/** Sequência de semanas consecutivas com meta batida (a semana atual conta se já foi batida). */
export function habitWeekStreak(habit: Habit, today: ISODate, logs: LogIndex): number {
  let streak = 0
  let weekStart = startOfWeek(today)
  const current = getWeekProgress(habit, addDays(weekStart, 6) > today ? today : addDays(weekStart, 6), logs)
  if (current.goal > 0 && current.done >= current.goal) streak++
  for (let i = 0; i < 104; i++) {
    weekStart = addDays(weekStart, -7)
    if (addDays(weekStart, 6) < habit.startDate) break
    const p = getWeekProgress(habit, addDays(weekStart, 6), logs)
    if (p.goal > 0 && p.done >= p.goal) streak++
    else break
  }
  return streak
}
