/**
 * Histórico de metas: a meta (frequência + meta por sessão) é versionada por
 * semana. Mudar a meta vale da semana atual em diante; semanas anteriores
 * continuam sendo avaliadas com a meta que valia na época.
 */
import { startOfWeek, type ISODate } from '../date'
import type { Habit, HabitGoalVersion, HabitSchedule, HabitTarget } from '../models/habit'

export function goalVersions(habit: Habit): HabitGoalVersion[] {
  return habit.goalHistory && habit.goalHistory.length > 0
    ? habit.goalHistory
    : [{ from: startOfWeek(habit.startDate), schedule: habit.schedule, target: habit.target }]
}

/** O hábito com a meta que valia na semana de `date`. */
export function habitForDate(habit: Habit, date: ISODate): Habit {
  const history = habit.goalHistory
  if (!history || history.length < 2) return habit
  const week = startOfWeek(date)
  let version = history[0]!
  for (const v of history) if (v.from <= week) version = v
  if (version.schedule === habit.schedule && version.target === habit.target) return habit
  return { ...habit, schedule: version.schedule, target: version.target }
}

export function sameSchedule(a: HabitSchedule, b: HabitSchedule): boolean {
  const da = a.days ? [...a.days].sort().join(',') : null
  const db = b.days ? [...b.days].sort().join(',') : null
  return a.weeklyGoal === b.weeklyGoal && da === db
}

export function sameTarget(a: HabitTarget | null, b: HabitTarget | null): boolean {
  if (!a || !b) return a === b
  return a.amount === b.amount && a.unit === b.unit
}

/**
 * Aplica uma nova meta a partir da semana de `today`. Se a meta não mudou,
 * devolve o hábito intacto.
 */
export function applyGoalChange(habit: Habit, schedule: HabitSchedule, target: HabitTarget | null, today: ISODate): Habit {
  if (sameSchedule(habit.schedule, schedule) && sameTarget(habit.target, target)) return habit
  const from = startOfWeek(today)
  const kept = goalVersions(habit).filter((v) => v.from < from)
  const history: HabitGoalVersion[] = [...kept, { from, schedule, target }]
  return { ...habit, schedule, target, goalHistory: history.length > 1 ? history : undefined }
}

/** Semana em que a meta atual começou a valer. */
export function currentGoalSince(habit: Habit): ISODate {
  const versions = goalVersions(habit)
  return versions[versions.length - 1]!.from
}
