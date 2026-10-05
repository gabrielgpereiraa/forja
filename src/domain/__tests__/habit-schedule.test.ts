import { describe, expect, it } from 'vitest'
import { expectedSessionsBy, getHabitDayState, habitWeekStreak, indexLogs } from '../rules/habit-schedule'
import { habit, log } from './fixtures'

const MON = '2026-10-05' as const

describe('ritmo esperado', () => {
  it('distribui meta flexível ao longo da semana', () => {
    const h = habit({ schedule: { weeklyGoal: 4, days: null } })
    const seq = [0, 1, 2, 3, 4, 5, 6].map((i) => expectedSessionsBy(h, MON, i))
    expect(seq).toEqual([1, 2, 2, 3, 3, 4, 4])
  })
  it('hábito diário espera uma sessão por dia', () => {
    const h = habit({ schedule: { weeklyGoal: 7, days: null } })
    expect(expectedSessionsBy(h, MON, 2)).toBe(3)
  })
  it('dias fixos contam apenas os dias escolhidos', () => {
    const h = habit({ schedule: { weeklyGoal: 3, days: [1, 3, 5] } }) // seg, qua, sex
    expect([0, 1, 2, 3, 4].map((i) => expectedSessionsBy(h, MON, i))).toEqual([1, 1, 2, 2, 3])
  })
  it('hábito criado no meio da semana ajusta a meta', () => {
    const h = habit({ startDate: '2026-10-09', schedule: { weeklyGoal: 5, days: null } }) // sexta
    const s = getHabitDayState(h, '2026-10-09', indexLogs([]))
    expect(s.week.goal).toBe(3)
  })
})

describe('estado do hábito no dia', () => {
  it('fica obrigatório quando abaixo do ritmo', () => {
    const h = habit()
    const s = getHabitDayState(h, MON, indexLogs([]))
    expect(s.requirement).toBe('required')
    expect(s.pace).toBe('on_track')
  })
  it('fica opcional quando adiantado', () => {
    const h = habit({ id: 'g' })
    const logs = indexLogs([log('g', '2026-10-05'), log('g', '2026-10-06')])
    const s = getHabitDayState(h, '2026-10-07', logs) // qua: esperado 2
    expect(s.requirement).toBe('optional')
  })
  it('dias fixos: recuperar fora do dia é opcional', () => {
    const h = habit({ schedule: { weeklyGoal: 3, days: [1, 3, 5] } })
    const tue = getHabitDayState(h, '2026-10-06', indexLogs([]))
    expect(tue.requirement).toBe('optional')
    expect(tue.pace).toBe('behind')
    expect(getHabitDayState(h, '2026-10-07', indexLogs([])).requirement).toBe('required')
  })
  it('detecta atraso e risco', () => {
    const h = habit({ schedule: { weeklyGoal: 6, days: null } })
    const thu = getHabitDayState(h, '2026-10-06', indexLogs([]))
    expect(thu.pace).toBe('behind')
    const sat = getHabitDayState(h, '2026-10-10', indexLogs([]))
    expect(sat.pace).toBe('at_risk')
  })
  it('meta batida e excedida', () => {
    const h = habit({ id: 'm', schedule: { weeklyGoal: 2, days: null } })
    const logs = indexLogs([log('m', '2026-10-05'), log('m', '2026-10-06'), log('m', '2026-10-07')])
    const s = getHabitDayState(h, '2026-10-07', logs)
    expect(s.requirement).toBe('goal_met')
    expect(s.pace).toBe('exceeded')
  })
  it('crédito parcial para meta de duração', () => {
    const h = habit({ id: 'd', target: { amount: 30, unit: 'minutes' } })
    const s = getHabitDayState(h, MON, indexLogs([log('d', MON, 20, false)]))
    expect(s.sessionProgress).toBeCloseTo(2 / 3)
    expect(s.doneToday).toBe(false)
  })
})

describe('sequência semanal do hábito', () => {
  it('conta semanas consecutivas com meta batida', () => {
    const h = habit({ id: 'w', schedule: { weeklyGoal: 1, days: null }, startDate: '2026-09-01' })
    const logs = indexLogs([log('w', '2026-09-22'), log('w', '2026-09-29'), log('w', '2026-10-05')])
    expect(habitWeekStreak(h, '2026-10-06', logs)).toBe(3)
  })
})
