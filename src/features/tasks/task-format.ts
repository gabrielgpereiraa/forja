import { relativeDayLabel, type ISODate } from '@/domain/date'
import type { TaskDayItem } from '@/domain/rules/task-agenda'
import type { Task } from '@/domain/models/task'

export function dueLabel(task: Task, today: ISODate): { text: string; tone: 'muted' | 'danger' | 'primary' } | null {
  if (!task.dueDate) return null
  if (!task.completed && task.dueDate < today) {
    const text = relativeDayLabel(task.dueDate, today)
    return { text: `Atrasada · ${text.toLowerCase()}`, tone: 'danger' }
  }
  if (task.dueDate === today) return { text: 'Hoje', tone: 'primary' }
  return { text: relativeDayLabel(task.dueDate, today), tone: 'muted' }
}

export function lateLabel(item: TaskDayItem): string | null {
  if (item.role !== 'overdue' || item.daysLate <= 0) return null
  return item.daysLate === 1 ? 'Atrasada · 1 dia' : `Atrasada · ${item.daysLate} dias`
}
