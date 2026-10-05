import type { ISODate, Timestamp } from '../date'
import type { ScoreBreakdown } from '../scoring/types'

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
}
