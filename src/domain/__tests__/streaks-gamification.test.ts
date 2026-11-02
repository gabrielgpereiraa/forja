import { describe, expect, it } from 'vitest'
import type { ISODate } from '../date'
import { evaluateEvent } from '../gamification/engine'
import { getLevelInfo } from '../gamification/levels'
import type { DailyRecord } from '../models/day'
import { computeStreak } from '../rules/streaks'
import { habit, log, task } from './fixtures'

function rec(date: ISODate, score: number | null): DailyRecord {
  return {
    date,
    score,
    breakdown: { version: 'v1', score, base: score, components: [], adjustments: [], completion: 0, highlights: [] },
    completedHabits: 0,
    totalHabits: 0,
    completedTasks: 0,
    totalTasks: 0,
    closedAt: '',
    closedBy: 'user',
  }
}

describe('streaks', () => {
  it('sequência pendente enquanto hoje está aberto', () => {
    const r = { '2026-10-03': rec('2026-10-03', 7), '2026-10-04': rec('2026-10-04', 8) }
    expect(computeStreak(r, '2026-10-05')).toMatchObject({ current: 2, status: 'pending', best: 2 })
  })
  it('dias neutros não quebram', () => {
    const r = { '2026-10-02': rec('2026-10-02', 7), '2026-10-03': rec('2026-10-03', null), '2026-10-04': rec('2026-10-04', 8) }
    expect(computeStreak(r, '2026-10-04').current).toBe(2)
  })
  it('ontem aberto (em revisão) não zera a sequência', () => {
    const r = { '2026-10-02': rec('2026-10-02', 7), '2026-10-03': rec('2026-10-03', 8) }
    expect(computeStreak(r, '2026-10-05')).toMatchObject({ current: 2, status: 'pending' })
    const closedToday = { ...r, '2026-10-05': rec('2026-10-05', 9) }
    expect(computeStreak(closedToday, '2026-10-05')).toMatchObject({ current: 3, status: 'active', best: 3 })
  })
  it('detecta sequência quebrada ontem', () => {
    const r = { '2026-10-02': rec('2026-10-02', 7), '2026-10-03': rec('2026-10-03', 8), '2026-10-04': rec('2026-10-04', 3) }
    expect(computeStreak(r, '2026-10-05')).toMatchObject({ current: 0, status: 'broken', lostLength: 2, best: 2 })
  })
})

describe('gamificação', () => {
  it('curva de níveis', () => {
    expect(getLevelInfo(0).level).toBe(1)
    expect(getLevelInfo(160).level).toBe(2)
    expect(getLevelInfo(479)).toMatchObject({ level: 2, currentXp: 319, requiredXp: 320 })
  })
  it('sessão de hábito gera XP com atributo e foco por minuto', () => {
    const h = habit({ category: 'creative', target: { amount: 30, unit: 'minutes' } })
    const l = log(h.id, '2026-10-05', 30)
    const drafts = evaluateEvent({ type: 'habit.session_completed', habit: h, log: l, date: '2026-10-05' })
    expect(drafts).toEqual([expect.objectContaining({ resource: 'xp', amount: 20, attribute: 'creativity', sourceKey: `habitLog:${l.id}` })])
    // Foco vem do registro (concluído ou parcial), não da conclusão.
    const focus = evaluateEvent({ type: 'habit.progress_recorded', habit: h, log: log(h.id, '2026-10-05', 15), date: '2026-10-05' })
    expect(focus).toEqual([expect.objectContaining({ resource: 'focus', amount: 15 })])
  })
  it('tarefa de prioridade alta vale mais', () => {
    const drafts = evaluateEvent({ type: 'task.completed', task: task({ priority: 'high' }), date: '2026-10-05' })
    expect(drafts[0]?.amount).toBe(20)
  })
  it('marco de 7 dias', () => {
    const drafts = evaluateEvent({ type: 'day.closed', record: rec('2026-10-05', 8), streak: 7, date: '2026-10-05' })
    expect(drafts.map((d) => d.ruleId)).toEqual(['day.closed.score', 'day.closed.ritual', 'day.closed.streak_milestone'])
  })
})
