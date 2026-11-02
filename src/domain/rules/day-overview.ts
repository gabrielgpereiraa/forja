/**
 * Composição do "dia de produtividade": junta hábitos, tarefas e nota em uma
 * visão única consumida pelo dashboard, pelo encerramento do dia e pelo
 * histórico.
 */
import type { ISODate } from '../date'
import type { DailyRecord } from '../models/day'
import type { Habit, HabitLog } from '../models/habit'
import type { Task } from '../models/task'
import { computeDayScore, type ScoreBreakdown, type ScoringStrategy } from '../scoring'
import { getHabitsForDay, type HabitDayState, type LogIndex } from './habit-schedule'
import { getTasksForDay, type TaskDayItem } from './task-agenda'

export type DayPhase =
  /** Nada planejado. */
  | 'empty'
  | 'not_started'
  | 'in_progress'
  /** Tudo feito, aguardando encerramento. */
  | 'all_done'
  | 'closed'

export interface DayOverview {
  date: ISODate
  /** Hábitos que contam para hoje. */
  plannedHabits: HabitDayState[]
  /** Adiantados ou já com meta semanal batida. */
  optionalHabits: HabitDayState[]
  tasks: TaskDayItem[]
  /** Itens previstos (hábitos obrigatórios + tarefas do dia/atrasadas). */
  totalItems: number
  doneItems: number
  /** Progresso por itens (0–1) — "quanto já fiz". */
  progress: number
  /** Nota ao vivo (ou a gravada, se o dia estiver encerrado). */
  breakdown: ScoreBreakdown
  record: DailyRecord | null
  phase: DayPhase
  habitsDone: number
  tasksDone: number
  tasksTotal: number
  overdueCount: number
}

export interface DayOverviewInput {
  date: ISODate
  habits: readonly Habit[]
  logs: LogIndex
  tasks: readonly Task[]
  record: DailyRecord | null
}

export function buildDayOverview({ date, habits, logs, tasks, record }: DayOverviewInput): DayOverview {
  const states = getHabitsForDay(habits, date, logs)
  const plannedHabits = states.filter((s) => s.requirement === 'required')
  const optionalHabits = states.filter((s) => s.requirement !== 'required')
  const taskItems = getTasksForDay(tasks, date)
  const countedTasks = taskItems.filter((t) => t.role !== 'bonus')

  const habitsDone = plannedHabits.filter((h) => h.doneToday).length
  const tasksDone = countedTasks.filter((t) => t.doneOnDay).length
  const totalItems = plannedHabits.length + countedTasks.length
  const doneItems = habitsDone + tasksDone
  const breakdown = record?.breakdown ?? computeDayScore({ date, habits: states, tasks: taskItems })

  let phase: DayPhase
  if (record) phase = 'closed'
  else if (totalItems === 0) phase = 'empty'
  else if (doneItems === 0 && optionalHabits.every((h) => !h.doneToday)) phase = 'not_started'
  else if (doneItems >= totalItems) phase = 'all_done'
  else phase = 'in_progress'

  return {
    date,
    plannedHabits,
    optionalHabits,
    tasks: taskItems,
    totalItems,
    doneItems,
    progress: totalItems ? doneItems / totalItems : 0,
    breakdown,
    record,
    phase,
    habitsDone,
    tasksDone,
    tasksTotal: countedTasks.length,
    overdueCount: taskItems.filter((t) => t.role === 'overdue' && !t.doneOnDay).length,
  }
}

export function createDailyRecord(
  overview: DayOverview,
  closedBy: DailyRecord['closedBy'],
  closedAt: string,
  /**
   * Abre a janela de confirmação tardia? Falso quando o próprio usuário
   * encerra o dia depois que ele acabou (revisão da manhã): a revisão já era o
   * momento de confirmar, e o que ficou desmarcado conta como não cumprido.
   */
  lateWindow = true,
  /** Estratégia da nota. Padrão: a ativa (encerramento). Recálculos passam a do registro. */
  strategy?: ScoringStrategy,
): DailyRecord {
  const states = [...overview.plannedHabits, ...overview.optionalHabits]
  const breakdown = computeDayScore({ date: overview.date, habits: states, tasks: overview.tasks }, strategy)
  return {
    date: overview.date,
    score: breakdown.score,
    breakdown,
    completedHabits: overview.habitsDone,
    totalHabits: overview.plannedHabits.length,
    completedTasks: overview.tasksDone,
    totalTasks: overview.tasksTotal,
    closedAt,
    closedBy,
    awaitingConfirmation: lateWindow ? states.filter((s) => s.habit.confirmNextDay && !s.doneToday).map((s) => s.habit.id) : [],
  }
}

export type { HabitLog }
