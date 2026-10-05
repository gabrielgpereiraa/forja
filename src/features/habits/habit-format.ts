import { WEEKDAY_SHORT, WEEKDAYS_MONDAY_FIRST } from '@/domain/date'
import { TARGET_UNIT_LABEL, type Habit, type HabitTarget } from '@/domain/models/habit'
import type { HabitDayState } from '@/domain/rules/habit-schedule'
import type { HabitSchedule } from '@/domain/models/habit'
import { formatNumber } from '@/lib/utils'

export function formatAmount(amount: number, unit: HabitTarget['unit']): string {
  const u = TARGET_UNIT_LABEL[unit]
  if (unit === 'minutes') return `${formatNumber(amount)} min`
  if (unit === 'km') return `${formatNumber(amount, amount % 1 ? 1 : 0)} km`
  return `${formatNumber(amount)} ${amount === 1 ? u.singular : u.plural}`
}

export function formatTarget(target: HabitTarget | null): string | null {
  return target ? formatAmount(target.amount, target.unit) : null
}

export function formatSchedule(habit: Pick<Habit, 'schedule'>): string {
  const { days, weeklyGoal } = habit.schedule
  if (days && days.length > 0) {
    if (days.length === 7) return 'Todos os dias'
    return WEEKDAYS_MONDAY_FIRST.filter((d) => days.includes(d))
      .map((d) => WEEKDAY_SHORT[d])
      .join(', ')
  }
  if (weeklyGoal === 7) return 'Todos os dias'
  return `${weeklyGoal}x por semana`
}

/** "20 / 30 min" para metas numéricas parcialmente feitas. */
export function formatSessionProgress(state: HabitDayState): string | null {
  const t = state.habit.target
  if (!t) return null
  if (state.value <= 0) return formatAmount(t.amount, t.unit)
  if (state.value >= t.amount) return formatAmount(state.value, t.unit)
  return `${formatNumber(state.value)} / ${formatAmount(t.amount, t.unit)}`
}

export type PaceTone = 'warning' | 'danger' | 'success' | 'secondary' | 'outline'

export function paceBadge(state: HabitDayState): { label: string; tone: PaceTone } | null {
  switch (state.pace) {
    case 'exceeded':
      return { label: 'Meta excedida', tone: 'success' }
    case 'met':
      return { label: 'Meta batida', tone: 'success' }
    case 'at_risk':
      return { label: 'Meta em risco', tone: 'danger' }
    case 'behind':
      return { label: 'Atrasado', tone: 'warning' }
    default:
      return state.requirement === 'optional' && !state.doneToday ? { label: 'Adiantado', tone: 'outline' } : null
  }
}

/** Frase de ritmo: "faltam 2 em 3 dias". */
export function paceSentence(state: HabitDayState): string {
  const { done, goal, daysLeft } = state.week
  const remaining = Math.max(0, goal - done)
  if (goal === 0) return 'Começa na próxima semana'
  if (remaining === 0) return done > goal ? `${done - goal} além da meta` : 'Meta da semana concluída'
  const daysAfterToday = state.doneToday ? daysLeft - 1 : daysLeft
  return `Faltam ${remaining} em ${daysAfterToday} ${daysAfterToday === 1 ? 'dia' : 'dias'}`
}

/** "4x por semana · 30 min" */
export function formatGoal(goal: { schedule: HabitSchedule; target: HabitTarget | null }): string {
  const target = formatTarget(goal.target)
  return target ? `${formatSchedule(goal)} · ${target}` : formatSchedule(goal)
}
