/**
 * Confirmação tardia ("Confirmar na manhã seguinte").
 *
 * Um dia encerrado continua bloqueado. A única exceção: na manhã seguinte
 * (enquanto ele ainda é "ontem"), os hábitos que estavam marcados para
 * confirmação e ficaram em aberto no encerramento podem ser confirmados. A
 * conclusão pertence ao dia anterior, que é recalculado.
 */
import { addDays, type ISODate } from '../date'
import type { DailyRecord, DayScoringSnapshot } from '../models/day'
import type { Habit } from '../models/habit'
import type { ID } from '../models/ids'
import type { ScoreBreakdown, ScoringStrategy } from '../scoring/types'
import type { DayOverview } from './day-overview'
import { isHabitActiveOn, logKey, type HabitDayState, type LogIndex } from './habit-schedule'

export interface LateConfirmationCandidates {
  /** Elegíveis e ainda não concluídos: podem ser confirmados. */
  pending: ID[]
  /** Já confirmados depois do encerramento: podem ser desfeitos. */
  confirmed: ID[]
}

/** A janela vale enquanto o dia encerrado é "ontem" (vira junto com o início do dia, ex.: 04:00). */
export function isWithinLateWindow(date: ISODate, today: ISODate): boolean {
  return date === addDays(today, -1)
}

/**
 * Hábitos que o registro permite confirmar. Registros novos trazem a lista
 * congelada no encerramento (ligar a flag depois não libera nada). Registros
 * antigos, sem a lista, usam a flag atual dos hábitos ativos naquele dia.
 */
export function eligibleLateHabitIds(record: DailyRecord, habits: readonly Habit[]): ID[] {
  if (record.awaitingConfirmation) return record.awaitingConfirmation
  return habits.filter((h) => h.confirmNextDay && isHabitActiveOn(h, record.date)).map((h) => h.id)
}

export function lateConfirmationCandidates(
  record: DailyRecord | null | undefined,
  habits: readonly Habit[],
  logs: LogIndex,
  today: ISODate,
): LateConfirmationCandidates {
  if (!record || !isWithinLateWindow(record.date, today)) return { pending: [], confirmed: [] }
  const active = new Set(habits.filter((h) => isHabitActiveOn(h, record.date)).map((h) => h.id))
  const confirmed = (record.lateConfirmations ?? []).map((c) => c.habitId).filter((id) => active.has(id))
  const confirmedSet = new Set(confirmed)
  const pending = eligibleLateHabitIds(record, habits).filter(
    (id) => active.has(id) && !confirmedSet.has(id) && !logs.get(logKey(id, record.date))?.completed,
  )
  return { pending, confirmed }
}

/**
 * Hábitos que a revisão da manhã ("Ontem ainda está aberto") oferece para
 * marcar em ontem: somente os configurados com "Confirmar na manhã seguinte".
 * Hábitos comuns pendentes não entram — não dá para completar o passado.
 */
export function habitsForMorningReview(overview: Pick<DayOverview, 'plannedHabits' | 'optionalHabits'>): HabitDayState[] {
  return [...overview.plannedHabits, ...overview.optionalHabits].filter((s) => s.habit.confirmNextDay)
}

/**
 * Nota de um dia encerrado a partir do retrato do encerramento, aplicando só
 * as confirmações tardias vigentes: cada hábito confirmado passa a concluído
 * (progresso 1, +1 sessão na semana). Sem confirmações, reproduz a nota do
 * encerramento. Tarefas e demais hábitos ficam exatamente como estavam.
 */
export function rescoreFromSnapshot(
  snapshot: DayScoringSnapshot,
  date: ISODate,
  confirmed: ReadonlySet<ID>,
  strategy: ScoringStrategy,
): { score: number | null; breakdown: ScoreBreakdown; completedHabits: number } {
  const habits = snapshot.habits.map((h) =>
    confirmed.has(h.habitId) && !h.doneToday
      ? { ...h, doneToday: true, sessionProgress: 1, week: { ...h.week, done: h.week.done + 1 } }
      : h,
  )
  const breakdown = strategy.compute({ date, habits, tasks: snapshot.tasks })
  const completedHabits = habits.filter((h) => h.requirement === 'required' && h.doneToday).length
  return { score: breakdown.score, breakdown, completedHabits }
}
