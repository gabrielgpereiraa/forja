/**
 * Regras de agenda de tarefas: o que pertence a um dia, o que está atrasado,
 * como agrupar as próximas.
 */
import { diffDays, type ISODate } from '../date'
import type { Task } from '../models/task'
import { TASK_PRIORITY_META } from '../models/task'

export type TaskDayRole =
  /** Prevista para o dia. */
  | 'due'
  /** Prevista para antes e ainda pendente (ou concluída neste dia). */
  | 'overdue'
  /** Sem data / futura, mas concluída neste dia (adiantou). */
  | 'bonus'

export interface TaskDayItem {
  task: Task
  role: TaskDayRole
  /** Dias de atraso (0 quando não atrasada). */
  daysLate: number
  doneOnDay: boolean
}

/**
 * Tarefas de um dia de produtividade:
 * - previstas para o dia (concluídas ou não);
 * - atrasadas: previstas antes e pendentes, ou concluídas *neste* dia;
 * - bônus: sem data/futuras concluídas neste dia.
 *
 * Para dias passados, uma tarefa atrasada que só foi concluída depois ainda
 * conta como pendente naquele dia — o que mantém o histórico honesto.
 */
export function getTasksForDay(tasks: readonly Task[], date: ISODate): TaskDayItem[] {
  const items: TaskDayItem[] = []
  for (const task of tasks) {
    const doneOnDay = task.completed && task.completedOn === date
    const doneBeforeDay = task.completed && task.completedOn !== null && task.completedOn < date
    if (task.dueDate === date) {
      if (doneBeforeDay) continue // adiantada para outro dia
      items.push({ task, role: 'due', daysLate: 0, doneOnDay })
    } else if (task.dueDate !== null && task.dueDate < date) {
      if (doneBeforeDay) continue
      if (task.createdOn > date) continue
      if (!task.completed || doneOnDay || (task.completedOn !== null && task.completedOn > date)) {
        items.push({ task, role: 'overdue', daysLate: diffDays(task.dueDate, date), doneOnDay })
      }
    } else if (doneOnDay) {
      items.push({ task, role: 'bonus', daysLate: 0, doneOnDay })
    }
  }
  return sortTaskItems(items)
}

const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 } as const

export function sortTaskItems(items: TaskDayItem[]): TaskDayItem[] {
  return items.sort((a, b) => {
    if (a.doneOnDay !== b.doneOnDay) return a.doneOnDay ? 1 : -1
    if (a.role !== b.role) return a.role === 'overdue' ? -1 : b.role === 'overdue' ? 1 : 0
    const p = PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority]
    if (p !== 0) return p
    return a.task.createdAt.localeCompare(b.task.createdAt)
  })
}

export function taskWeight(task: Pick<Task, 'priority'>): number {
  return TASK_PRIORITY_META[task.priority].weight
}

export function isOverdue(task: Task, today: ISODate): boolean {
  return !task.completed && task.dueDate !== null && task.dueDate < today
}

export type TaskBucket = 'today' | 'upcoming' | 'someday' | 'done'

export function bucketOf(task: Task, today: ISODate): TaskBucket {
  if (task.completed) return 'done'
  if (task.dueDate === null) return 'someday'
  if (task.dueDate <= today) return 'today'
  return 'upcoming'
}

/**
 * Dias encerrados são somente leitura: com o dia `date` encerrado não se
 * conclui tarefa nele, e uma tarefa concluída num dia encerrado não é reaberta.
 */
export function isTaskLocked(task: Task, closedDays: { readonly [date: string]: unknown }, date: ISODate): boolean {
  if (task.completed) return Boolean(task.completedOn && closedDays[task.completedOn])
  return Boolean(closedDays[date])
}

/**
 * Tarefa concluída num dia encerrado faz parte do histórico (XP e registro do
 * dia): não pode ser excluída. Pendentes — inclusive atrasadas — e concluídas
 * em dia ainda aberto seguem excluíveis.
 */
export function isTaskDeleteLocked(task: Task, closedDays: { readonly [date: string]: unknown }): boolean {
  return Boolean(task.completed && task.completedOn && closedDays[task.completedOn])
}

/** Motivo exibido quando a exclusão está bloqueada. */
export const TASK_DELETE_LOCKED_REASON = 'Concluída em um dia encerrado: a tarefa faz parte do histórico e não pode ser excluída.'
