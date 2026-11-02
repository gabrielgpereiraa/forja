import type { ISODate, Timestamp } from '../date'
import type { ID } from './ids'
import type { ScoreBreakdown, ScoringHabit, ScoringTask } from '../scoring/types'

/** Hábito confirmado na manhã seguinte, depois do encerramento (trilha de auditoria). */
export interface LateConfirmation {
  habitId: ID
  confirmedAt: Timestamp
  /** Valor registrado antes da confirmação (para desfazer sem perder progresso parcial). */
  previousValue: number
}

/**
 * Retrato do plano no encerramento: exatamente os dados que a nota usou.
 * Recalcular o dia (confirmação tardia) parte daqui, e não dos dados atuais —
 * mudanças posteriores em tarefas, prioridades ou metas não alteram o
 * histórico. Só ids e campos da nota (nenhum texto).
 */
export interface DayScoringSnapshot {
  habits: (ScoringHabit & { habitId: ID })[]
  tasks: (ScoringTask & { taskId: ID })[]
}

/** Snapshot imutável de um dia encerrado. */
export interface DailyRecord {
  date: ISODate
  /** `null` = dia sem nada planejado (neutro: não conta nem quebra sequência). */
  score: number | null
  breakdown: ScoreBreakdown
  completedHabits: number
  totalHabits: number
  completedTasks: number
  totalTasks: number
  closedAt: Timestamp
  closedBy: 'user' | 'auto'
  /**
   * Hábitos com "Confirmar na manhã seguinte" que estavam em aberto no
   * encerramento — os únicos que podem ser confirmados depois. Ausente em
   * registros antigos (anteriores a esta regra).
   */
  awaitingConfirmation?: ID[]
  /**
   * Plano usado na nota do encerramento. Ausente em registros anteriores a
   * esta regra (a confirmação tardia deles recalcula com os dados atuais).
   */
  scoringSnapshot?: DayScoringSnapshot
  /** Confirmações feitas depois do encerramento. */
  lateConfirmations?: LateConfirmation[]
}
