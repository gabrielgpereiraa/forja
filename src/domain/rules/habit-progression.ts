/**
 * Sugestões de progressão: o sistema observa as semanas desde a última
 * mudança de meta e propõe ajustes pequenos, uma variável por vez.
 *
 * - Subir: 4 semanas seguidas batendo a meta.
 * - Baixar: 2 semanas seguidas abaixo da meta — meta menor e constante evolui mais.
 *
 * Regra de passo: frequência primeiro até 5x/semana (hábitos flexíveis), depois
 * a meta por sessão (+~15%). Ao baixar, a frequência vai para perto do que foi
 * realmente feito; sem frequência ajustável, a meta por sessão cai ~20%.
 */
import { addDays, startOfWeek, type ISODate } from '../date'
import type { Habit, HabitSchedule, HabitTarget } from '../models/habit'
import { currentGoalSince } from './habit-goal-history'
import { getWeekProgress, type LogIndex } from './habit-schedule'

export const PROGRESSION = {
  weeksToIncrease: 4,
  weeksToDecrease: 2,
  /** Frequência a partir da qual se prefere aumentar a meta por sessão. */
  frequencyCeiling: 5,
  increaseRatio: 0.15,
  decreaseRatio: 0.2,
} as const

export interface GoalProposal {
  schedule: HabitSchedule
  target: HabitTarget | null
}

export interface ProgressionSuggestion {
  habitId: string
  kind: 'increase' | 'decrease'
  /** Qual variável muda. */
  change: 'frequency' | 'target'
  /** Semanas avaliadas (mais recente primeiro). */
  weeks: { weekStart: ISODate; done: number; goal: number }[]
  current: GoalProposal
  proposal: GoalProposal
}

function stepTarget(target: HabitTarget, direction: 1 | -1): HabitTarget | null {
  const { amount, unit } = target
  if (unit === 'minutes') {
    // Passos de 5 min a partir de 20 min; abaixo disso, de 1 em 1 (10 → 12, não 15).
    const step = amount >= 20 ? 5 : 1
    const raw = direction > 0 ? amount * (1 + PROGRESSION.increaseRatio) : amount * (1 - PROGRESSION.decreaseRatio)
    let next = Math.round(raw / step) * step
    if (direction > 0) next = Math.max(next, amount + step)
    else next = Math.max(1, Math.min(next, amount - step))
    return next === amount ? null : { amount: next, unit }
  }
  const delta = Math.max(1, Math.round(amount * (direction > 0 ? PROGRESSION.increaseRatio : PROGRESSION.decreaseRatio)))
  const next = Math.max(1, amount + direction * delta)
  return next === amount ? null : { amount: next, unit }
}

/**
 * Semanas completas avaliadas com a meta vigente (mais recente primeiro). Se a
 * semana passada terminou ontem e ainda não bateu a meta, ela fica de fora:
 * o domingo pode estar aguardando a revisão da manhã.
 */
function evaluatedWeeks(habit: Habit, today: ISODate, logs: LogIndex) {
  const since = currentGoalSince(habit)
  const firstFull = habit.startDate === startOfWeek(habit.startDate) ? habit.startDate : addDays(startOfWeek(habit.startDate), 7)
  const out: { weekStart: ISODate; done: number; goal: number }[] = []
  for (let w = addDays(startOfWeek(today), -7); w >= since && w >= firstFull && out.length < 8; w = addDays(w, -7)) {
    const p = getWeekProgress(habit, addDays(w, 6), logs)
    const endsYesterday = addDays(w, 6) === addDays(today, -1)
    if (endsYesterday && p.done < p.goal) continue
    out.push({ weekStart: w, done: p.done, goal: p.goal })
  }
  return out
}

export function suggestProgression(habit: Habit, today: ISODate, logs: LogIndex): ProgressionSuggestion | null {
  if (habit.archived) return null
  if (habit.progressionSnoozedUntil && today < habit.progressionSnoozedUntil) return null
  const weeks = evaluatedWeeks(habit, today, logs)
  const current: GoalProposal = { schedule: habit.schedule, target: habit.target }
  const flexible = habit.schedule.days === null

  const upWeeks = weeks.slice(0, PROGRESSION.weeksToIncrease)
  if (upWeeks.length === PROGRESSION.weeksToIncrease && upWeeks.every((w) => w.goal > 0 && w.done >= w.goal)) {
    const goal = habit.schedule.weeklyGoal
    const preferTarget = habit.target && (goal >= PROGRESSION.frequencyCeiling || !flexible)
    if (!preferTarget && flexible && goal < 7) {
      return { habitId: habit.id, kind: 'increase', change: 'frequency', weeks: upWeeks, current, proposal: { schedule: { weeklyGoal: goal + 1, days: null }, target: habit.target } }
    }
    const next = habit.target ? stepTarget(habit.target, 1) : null
    if (next) return { habitId: habit.id, kind: 'increase', change: 'target', weeks: upWeeks, current, proposal: { schedule: habit.schedule, target: next } }
    return null
  }

  const downWeeks = weeks.slice(0, PROGRESSION.weeksToDecrease)
  if (downWeeks.length === PROGRESSION.weeksToDecrease && downWeeks.every((w) => w.goal > 0 && w.done < w.goal)) {
    const goal = habit.schedule.weeklyGoal
    if (flexible && goal > 1) {
      const avg = downWeeks.reduce((s, w) => s + w.done, 0) / downWeeks.length
      const nextGoal = Math.max(1, Math.min(goal - 1, Math.ceil(avg) + 1))
      return { habitId: habit.id, kind: 'decrease', change: 'frequency', weeks: downWeeks, current, proposal: { schedule: { weeklyGoal: nextGoal, days: null }, target: habit.target } }
    }
    const next = habit.target ? stepTarget(habit.target, -1) : null
    if (next) return { habitId: habit.id, kind: 'decrease', change: 'target', weeks: downWeeks, current, proposal: { schedule: habit.schedule, target: next } }
  }
  return null
}

export function suggestAll(habits: readonly Habit[], today: ISODate, logs: LogIndex): ProgressionSuggestion[] {
  return habits.map((h) => suggestProgression(h, today, logs)).filter((s): s is ProgressionSuggestion => s !== null)
}
