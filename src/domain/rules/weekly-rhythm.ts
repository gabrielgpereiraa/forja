/**
 * Ritmo da semana — indicador próprio, fora da nota do dia (nota v2).
 *
 * Por hábito com sessões esperadas até hoje:
 *   min(1, (concluídas na semana até hoje + parcial de hoje) ÷ esperadas até hoje)
 * O parcial de hoje é o progresso da sessão quando ainda não foi concluída;
 * concluída, ela já está nas concluídas (não conta duas vezes). Parciais de
 * dias anteriores não contam: não viraram sessão.
 */
import type { HabitDayState } from './habit-schedule'

export interface HabitRhythm {
  habitId: string
  name: string
  /** Sessões concluídas na semana até hoje (inclui hoje, se concluída). */
  done: number
  /** Progresso parcial de hoje somado (0 quando a sessão de hoje já foi concluída). */
  partialToday: number
  expected: number
  ratio: number
}

export interface WeeklyRhythm {
  /** Média dos hábitos (0–1); `null` sem metas em andamento. */
  ratio: number | null
  habits: HabitRhythm[]
}

export function weeklyRhythm(states: readonly HabitDayState[]): WeeklyRhythm {
  const habits = states
    .filter((s) => s.week.expectedByToday > 0)
    .map((s): HabitRhythm => {
      const partialToday = s.doneToday ? 0 : Math.max(0, Math.min(1, s.sessionProgress))
      const expected = s.week.expectedByToday
      return {
        habitId: s.habit.id,
        name: s.habit.name,
        done: s.week.done,
        partialToday,
        expected,
        ratio: Math.min(1, (s.week.done + partialToday) / expected),
      }
    })
  const ratio = habits.length ? habits.reduce((sum, h) => sum + h.ratio, 0) / habits.length : null
  return { ratio, habits }
}
