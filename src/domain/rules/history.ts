import { addDays, dateRange, startOfWeek, type ISODate } from '../date'
import type { Habit } from '../models/habit'
import { getWeekProgress, type LogIndex } from './habit-schedule'
import type { RecordMap } from './streaks'

export interface ScorePoint {
  date: ISODate
  score: number | null
  /** Média móvel de 7 dias (ignora dias neutros). */
  avg7: number | null
}

export function buildScoreSeries(records: RecordMap, from: ISODate, to: ISODate): ScorePoint[] {
  const dates = dateRange(from, to)
  return dates.map((date) => {
    const window: number[] = []
    for (let i = 0; i < 7; i++) {
      const s = records[addDays(date, -i)]?.score
      if (s !== null && s !== undefined) window.push(s)
    }
    const score = records[date]?.score ?? null
    return {
      date,
      score,
      avg7: window.length ? Math.round((window.reduce((a, b) => a + b, 0) / window.length) * 10) / 10 : null,
    }
  })
}

export interface WeekConsistency {
  weekStart: ISODate
  /** Sessões feitas / meta (limitado a 100% por hábito). */
  ratio: number | null
  done: number
  goal: number
}

export function buildWeeklyConsistency(habits: readonly Habit[], logs: LogIndex, today: ISODate, weeks = 8): WeekConsistency[] {
  const current = startOfWeek(today)
  const out: WeekConsistency[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(current, -7 * i)
    const end = addDays(weekStart, 6)
    const ref = end > today ? today : end
    let done = 0
    let goal = 0
    for (const h of habits) {
      if (h.archived || h.startDate > end) continue
      const p = getWeekProgress(h, ref, logs)
      done += Math.min(p.done, p.goal)
      goal += p.goal
    }
    out.push({ weekStart, ratio: goal ? done / goal : null, done, goal })
  }
  return out
}
