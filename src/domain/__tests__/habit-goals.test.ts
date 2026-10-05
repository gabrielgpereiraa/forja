import { describe, expect, it } from 'vitest'
import { addDays, type ISODate } from '../date'
import { applyGoalChange, habitForDate } from '../rules/habit-goal-history'
import { suggestProgression } from '../rules/habit-progression'
import { getWeekProgress, habitWeekStreak, indexLogs } from '../rules/habit-schedule'
import { habit, log } from './fixtures'

const TODAY = '2026-10-07' as const // quarta
const weeksAgo = (n: number) => addDays('2026-10-05', -7 * n) // segundas anteriores

/** Gera `perWeek` sessões nas segundas…, para as semanas indicadas. */
function sessions(habitId: string, weeks: number[], perWeek: number, value = 1) {
  return weeks.flatMap((w) => Array.from({ length: perWeek }, (_, i) => log(habitId, addDays(weeksAgo(w), i) as ISODate, value)))
}

describe('histórico de metas', () => {
  it('mudar a meta não reescreve semanas passadas', () => {
    const h0 = habit({ id: 'ex', startDate: '2026-09-01', schedule: { weeklyGoal: 3, days: null } })
    const logs = indexLogs(sessions('ex', [1], 3))
    const before = getWeekProgress(h0, addDays(weeksAgo(1), 6), logs)
    expect(before).toMatchObject({ done: 3, goal: 3 })

    const h1 = applyGoalChange(h0, { weeklyGoal: 5, days: null }, null, TODAY)
    expect(h1.goalHistory).toHaveLength(2)
    expect(getWeekProgress(h1, addDays(weeksAgo(1), 6), logs).goal).toBe(3) // semana passada: meta antiga
    expect(getWeekProgress(h1, TODAY, logs).goal).toBe(5) // semana atual: meta nova
    expect(habitWeekStreak(h1, TODAY, logs)).toBe(1)
  })

  it('várias mudanças na mesma semana substituem a versão da semana', () => {
    let h = habit({ startDate: '2026-09-01', schedule: { weeklyGoal: 3, days: null } })
    h = applyGoalChange(h, { weeklyGoal: 4, days: null }, null, TODAY)
    h = applyGoalChange(h, { weeklyGoal: 5, days: null }, null, '2026-10-09')
    expect(h.goalHistory?.map((v) => v.schedule.weeklyGoal)).toEqual([3, 5])
    expect(habitForDate(h, '2026-09-20').schedule.weeklyGoal).toBe(3)
  })

  it('meta por sessão antiga vale para o dia antigo', () => {
    let h = habit({ startDate: '2026-09-01', target: { amount: 30, unit: 'minutes' } })
    h = applyGoalChange(h, h.schedule, { amount: 40, unit: 'minutes' }, TODAY)
    expect(habitForDate(h, '2026-09-28').target?.amount).toBe(30)
    expect(habitForDate(h, TODAY).target?.amount).toBe(40)
  })
})

describe('sugestão de progressão', () => {
  it('sobe a frequência após 4 semanas batidas (até 5x)', () => {
    const h = habit({ id: 'g', startDate: '2026-08-01', schedule: { weeklyGoal: 3, days: null }, target: { amount: 30, unit: 'minutes' } })
    const s = suggestProgression(h, TODAY, indexLogs(sessions('g', [1, 2, 3, 4], 3, 30)))
    expect(s).toMatchObject({ kind: 'increase', change: 'frequency' })
    expect(s?.proposal.schedule.weeklyGoal).toBe(4)
  })

  it('com 5x/semana, sobe a duração (~15%, múltiplo de 5)', () => {
    const h = habit({ id: 'e', startDate: '2026-08-01', schedule: { weeklyGoal: 5, days: null }, target: { amount: 30, unit: 'minutes' } })
    const s = suggestProgression(h, TODAY, indexLogs(sessions('e', [1, 2, 3, 4], 5, 30)))
    expect(s).toMatchObject({ kind: 'increase', change: 'target' })
    expect(s?.proposal.target).toEqual({ amount: 35, unit: 'minutes' })
  })

  it('metas curtas sobem e descem em passos pequenos', () => {
    const h = habit({ id: 'm', startDate: '2026-08-01', schedule: { weeklyGoal: 3, days: [1, 3, 5] }, target: { amount: 10, unit: 'minutes' } })
    const up = suggestProgression(h, TODAY, indexLogs(sessions('m', [1, 2, 3, 4], 3, 10)))
    expect(up?.proposal.target).toEqual({ amount: 12, unit: 'minutes' })
    const down = suggestProgression(h, TODAY, indexLogs(sessions('m', [1, 2], 2, 10)))
    expect(down).toMatchObject({ kind: 'decrease', change: 'target', proposal: { target: { amount: 8 } } })
  })

  it('não sugere com menos de 4 semanas desde a última mudança', () => {
    let h = habit({ id: 'c', startDate: '2026-08-01', schedule: { weeklyGoal: 3, days: null } })
    h = applyGoalChange(h, { weeklyGoal: 3, days: [1, 2, 3] }, null, weeksAgo(2))
    expect(suggestProgression(h, TODAY, indexLogs(sessions('c', [1, 2, 3, 4], 3)))).toBeNull()
  })

  it('baixa perto do que foi feito após 2 semanas abaixo', () => {
    const h = habit({ id: 'd', startDate: '2026-08-01', schedule: { weeklyGoal: 5, days: null } })
    const s = suggestProgression(h, TODAY, indexLogs([...sessions('d', [1], 1), ...sessions('d', [2], 2)]))
    expect(s).toMatchObject({ kind: 'decrease', change: 'frequency' })
    expect(s?.proposal.schedule.weeklyGoal).toBe(3)
  })

  it('semana que terminou ontem sem meta batida aguarda a revisão', () => {
    const h = habit({ id: 'y', startDate: '2026-08-01', schedule: { weeklyGoal: 5, days: null } })
    // Segunda 05/10: semana 28/09 terminou ontem com 4/5 (domingo pode ser confirmado).
    const logs = indexLogs([...sessions('y', [1], 4), ...sessions('y', [2], 1), ...sessions('y', [3], 5)])
    expect(suggestProgression(h, '2026-10-05', logs)).toBeNull()
    expect(suggestProgression(h, '2026-10-06', logs)).toMatchObject({ kind: 'decrease' })
  })

  it('respeita o "agora não"', () => {
    const h = habit({ id: 'z', startDate: '2026-08-01', schedule: { weeklyGoal: 5, days: null }, progressionSnoozedUntil: '2026-10-15' })
    expect(suggestProgression(h, TODAY, indexLogs([]))).toBeNull()
  })
})
