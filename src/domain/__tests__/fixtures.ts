import type { ISODate } from '../date'
import type { Habit, HabitLog } from '../models/habit'
import type { Task } from '../models/task'

let seq = 0

export function habit(partial: Partial<Habit> = {}): Habit {
  seq++
  return {
    id: partial.id ?? `h${seq}`,
    name: 'Hábito',
    category: 'health',
    schedule: { weeklyGoal: 4, days: null },
    target: null,
    icon: 'dumbbell',
    color: 'lime',
    archived: false,
    startDate: '2026-01-01',
    createdAt: '2026-01-01T10:00:00.000Z',
    order: seq,
    ...partial,
  }
}

export function log(habitId: string, date: ISODate, value = 1, completed = true): HabitLog {
  seq++
  return { id: `l${seq}`, habitId, date, value, completed, createdAt: `${date}T10:00:00.000Z`, updatedAt: `${date}T10:00:00.000Z` }
}

export function task(partial: Partial<Task> = {}): Task {
  seq++
  return {
    id: `t${seq}`,
    title: 'Tarefa',
    dueDate: '2026-10-05',
    priority: 'normal',
    completed: false,
    completedAt: null,
    completedOn: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    createdOn: '2026-10-01',
    ...partial,
  }
}
