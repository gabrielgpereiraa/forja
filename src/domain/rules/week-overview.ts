import { addDays, weekDates, type ISODate } from '../date'
import type { DailyRecord } from '../models/day'
import type { Habit } from '../models/habit'
import type { Task } from '../models/task'
import { buildDayOverview } from './day-overview'
import {
  getWeekProgress,
  isHabitActiveOn,
  isPlannedWeekday,
  logKey,
  type HabitWeekProgress,
  type LogIndex,
} from './habit-schedule'

export type HabitDayMark = 'done' | 'partial' | 'missed' | 'planned' | 'rest' | 'inactive'

export interface WeekHabitRow {
  habit: Habit
  progress: HabitWeekProgress
  marks: { date: ISODate; mark: HabitDayMark }[]
}

export interface WeekDayColumn {
  date: ISODate
  score: number | null
  /** Nota é prévia (dia de hoje ainda aberto). */
  live: boolean
  isFuture: boolean
  habitsDone: number
  tasksDone: number
  tasksTotal: number
}

export interface WeekOverview {
  weekStart: ISODate
  days: WeekDayColumn[]
  habits: WeekHabitRow[]
  averageScore: number | null
  sessionsDone: number
  sessionsGoal: number
  tasksDone: number
  tasksTotal: number
  goalsMet: number
}

export function buildWeekOverview(input: {
  weekStart: ISODate
  today: ISODate
  habits: readonly Habit[]
  logs: LogIndex
  tasks: readonly Task[]
  records: Readonly<Record<string, DailyRecord | undefined>>
}): WeekOverview {
  const { weekStart, today, habits, logs, tasks, records } = input
  const dates = weekDates(weekStart)
  const lastDay = addDays(weekStart, 6)
  const refDate = today < lastDay ? (today < weekStart ? weekStart : today) : lastDay

  const days: WeekDayColumn[] = dates.map((date) => {
    const record = records[date] ?? null
    const isFuture = date > today
    if (isFuture) return { date, score: null, live: false, isFuture, habitsDone: 0, tasksDone: 0, tasksTotal: 0 }
    if (record) {
      return {
        date,
        score: record.score,
        live: false,
        isFuture,
        habitsDone: record.completedHabits,
        tasksDone: record.completedTasks,
        tasksTotal: record.totalTasks,
      }
    }
    const o = buildDayOverview({ date, habits, logs, tasks, record: null })
    return {
      date,
      score: o.breakdown.score,
      // Sem registro = prévia (hoje em andamento ou ontem aguardando revisão).
      live: true,
      isFuture,
      habitsDone: o.habitsDone,
      tasksDone: o.tasksDone,
      tasksTotal: o.tasksTotal,
    }
  })

  const rows: WeekHabitRow[] = habits
    .filter((h) => !h.archived && h.startDate <= lastDay)
    .sort((a, b) => a.order - b.order)
    .map((habit) => {
      const progress = getWeekProgress(habit, refDate, logs)
      const marks = dates.map((date) => {
        const log = logs.get(logKey(habit.id, date))
        let mark: HabitDayMark
        if (!isHabitActiveOn(habit, date)) mark = 'inactive'
        else if (log?.completed) mark = 'done'
        else if (log && log.value > 0) mark = 'partial'
        else if (date > today) mark = isPlannedWeekday(habit, date) ? 'planned' : 'rest'
        else if (date === today) mark = 'planned'
        else mark = habit.schedule.days?.length ? (isPlannedWeekday(habit, date) ? 'missed' : 'rest') : 'rest'
        return { date, mark }
      })
      return { habit, progress, marks }
    })

  const scored = days.filter((d) => d.score !== null)
  const averageScore = scored.length
    ? Math.round((scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length) * 10) / 10
    : null

  return {
    weekStart,
    days,
    habits: rows,
    averageScore,
    sessionsDone: rows.reduce((s, r) => s + Math.min(r.progress.done, r.progress.goal), 0),
    sessionsGoal: rows.reduce((s, r) => s + r.progress.goal, 0),
    tasksDone: days.reduce((s, d) => s + d.tasksDone, 0),
    tasksTotal: days.reduce((s, d) => s + d.tasksTotal, 0),
    goalsMet: rows.filter((r) => r.progress.goal > 0 && r.progress.done >= r.progress.goal).length,
  }
}
