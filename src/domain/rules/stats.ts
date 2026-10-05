import { addDays, startOfWeek, type ISODate } from '../date'
import { getLevelInfo } from '../gamification/levels'
import { sumResource } from '../gamification/engine'
import type { DailyRecord } from '../models/day'
import type { LedgerEntry, PlayerStats } from '../models/gamification'
import type { Habit, HabitLog } from '../models/habit'
import type { Task } from '../models/task'
import { getWeekProgress, type LogIndex } from './habit-schedule'
import { computeStreak, type RecordMap } from './streaks'

export function averageScore(records: RecordMap, from: ISODate, to: ISODate): number | null {
  let sum = 0
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = records[d]
    if (r && r.score !== null) {
      sum += r.score
      n++
    }
  }
  return n ? Math.round((sum / n) * 10) / 10 : null
}

/** Semanas completas com metas batidas (para conquistas). */
export function countWeeklyGoalsMet(habits: readonly Habit[], logs: LogIndex, today: ISODate): number {
  let total = 0
  for (const habit of habits) {
    let weekStart = startOfWeek(habit.startDate)
    for (let guard = 0; guard < 520 && weekStart <= today; guard++) {
      const end = addDays(weekStart, 6)
      const p = getWeekProgress(habit, end > today ? today : end, logs)
      if (p.goal > 0 && p.done >= p.goal) total++
      weekStart = addDays(weekStart, 7)
    }
  }
  return total
}

export function computePlayerStats(input: {
  today: ISODate
  habits: readonly Habit[]
  logs: readonly HabitLog[]
  logIndex: LogIndex
  tasks: readonly Task[]
  records: RecordMap
  ledger: readonly LedgerEntry[]
}): PlayerStats {
  const totalXp = sumResource(input.ledger, 'xp')
  const streak = computeStreak(input.records, input.today)
  const recs = Object.values(input.records).filter((r): r is DailyRecord => Boolean(r))
  return {
    totalXp,
    level: getLevelInfo(totalXp).level,
    habitSessions: input.logs.filter((l) => l.completed).length,
    tasksCompleted: input.tasks.filter((t) => t.completed).length,
    daysClosed: recs.filter((r) => r.score !== null).length,
    currentStreak: streak.current,
    bestStreak: streak.best,
    bestScore: recs.reduce((m, r) => Math.max(m, r.score ?? 0), 0),
    excellentDays: recs.filter((r) => (r.score ?? 0) >= 9).length,
    weeklyGoalsMet: countWeeklyGoalsMet(input.habits, input.logIndex, input.today),
    totalFocusMinutes: sumResource(input.ledger, 'focus'),
  }
}
