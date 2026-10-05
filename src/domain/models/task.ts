import type { ISODate, Timestamp } from '../date'
import type { ID } from './ids'

export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; weight: number }> = {
  low: { label: 'Baixa', weight: 0.5 },
  normal: { label: 'Normal', weight: 1 },
  high: { label: 'Alta', weight: 2 },
}

export interface Task {
  id: ID
  title: string
  description?: string
  /** `null` = sem data ("algum dia"). */
  dueDate: ISODate | null
  priority: TaskPriority
  completed: boolean
  completedAt: Timestamp | null
  /** Dia de produtividade em que foi concluída. */
  completedOn: ISODate | null
  createdAt: Timestamp
  /** Dia de produtividade em que foi criada. */
  createdOn: ISODate
}

export type TaskInput = Pick<Task, 'title' | 'description' | 'dueDate' | 'priority'>
