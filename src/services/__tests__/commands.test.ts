import { describe, expect, it } from 'vitest'
import { sumResource } from '@/domain/gamification/engine'
import { suggestProgression } from '@/domain/rules/habit-progression'
import { indexLogs } from '@/domain/rules/habit-schedule'
import { createEmptyData } from '../app-data'
import * as cmd from '../commands'
import { buildDemoData } from '../demo-seed'

const TODAY = '2026-10-05' as const

function base() {
  return cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-01')
}

describe('comandos', () => {
  it('concluir e desfazer hábito reverte XP', () => {
    const { data, habit } = cmd.createHabit(base(), { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 3, days: null }, target: null }, '2026-10-01')
    const done = cmd.toggleHabit(data, habit.id, TODAY)
    expect(done.feedback.xp).toBe(20)
    expect(done.feedback.achievements.map((a) => a.id)).toContain('first-step')
    const undone = cmd.toggleHabit(done.data, habit.id, TODAY)
    expect(sumResource(undone.data.ledger, 'xp')).toBe(0)
    expect(undone.data.logs).toHaveLength(0)
  })

  it('meta semanal gera bônus uma única vez e é revertida', () => {
    let { data, habit } = cmd.createHabit(base(), { name: 'Correr', category: 'health', icon: 'footprints', color: 'lime', schedule: { weeklyGoal: 2, days: null }, target: null }, '2026-10-01')
    data = cmd.toggleHabit(data, habit.id, '2026-10-05').data
    const r = cmd.toggleHabit(data, habit.id, '2026-10-06')
    expect(r.feedback.events).toContain('habit.weekly_goal_reached')
    expect(r.feedback.xp).toBe(70)
    const extra = cmd.toggleHabit(r.data, habit.id, '2026-10-07')
    expect(extra.feedback.xp).toBe(20)
    const back = cmd.toggleHabit(cmd.toggleHabit(extra.data, habit.id, '2026-10-07').data, habit.id, '2026-10-06')
    expect(back.data.ledger.some((e) => e.sourceKey.startsWith('weeklyGoal:'))).toBe(false)
  })

  it('progresso parcial não conclui sessão', () => {
    const { data, habit } = cmd.createHabit(base(), { name: 'Guitarra', category: 'creative', icon: 'guitar', color: 'violet', schedule: { weeklyGoal: 4, days: null }, target: { amount: 30, unit: 'minutes' } }, '2026-10-01')
    const partial = cmd.setHabitValue(data, habit.id, TODAY, 15)
    expect(partial.data.logs[0]?.completed).toBe(false)
    expect(partial.feedback.xp).toBe(0)
    expect(partial.feedback.focus).toBe(15)
    const full = cmd.setHabitValue(partial.data, habit.id, TODAY, 30)
    expect(full.feedback.xp).toBe(20)
    expect(full.feedback.focus).toBe(15)
    expect(sumResource(full.data.ledger, 'focus')).toBe(30)
  })

  it('encerrar dia grava snapshot e é definitivo (sem reabertura)', () => {
    let { data } = cmd.createTask(base(), { title: 'Limpar tênis', priority: 'normal', dueDate: TODAY }, TODAY)
    const taskId = data.tasks[0]!.id
    data = cmd.setTaskCompleted(data, taskId, true, TODAY).data
    const closed = cmd.closeDay(data, TODAY, 'user')
    expect(closed.data.records[TODAY]?.score).toBe(10)
    expect(closed.feedback.xp).toBe(100 + 10)
    // Não há comando de reabertura.
    expect('reopenDay' in cmd).toBe(false)
    // Encerrar de novo não regrava nem duplica recompensas.
    const again = cmd.closeDay(closed.data, TODAY, 'user')
    expect(again.data).toBe(closed.data)
    // O dia segue travado: reabrir a tarefa ou registrar hábito não muda nada.
    expect(cmd.setTaskCompleted(closed.data, taskId, false, TODAY).data).toBe(closed.data)
    expect(sumResource(closed.data.ledger, 'xp')).toBe(10 + 100 + 10)
  })

  it('ontem com plano fica aberto para a revisão da manhã', () => {
    let { data, habit } = cmd.createHabit(base(), { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }, '2026-10-01')
    data = cmd.autoCloseMissedDays(data, TODAY)
    expect(data.records['2026-10-03']?.closedBy).toBe('auto')
    expect(data.records['2026-10-04']).toBeUndefined()
    expect(cmd.isPendingReview(data, '2026-10-04', TODAY)).toBe(true)
    // Na manhã seguinte: confirma o hábito de ontem e encerra ontem.
    data = cmd.toggleHabit(data, habit.id, '2026-10-04').data
    const closed = cmd.closeDay(data, '2026-10-04', 'user')
    expect(closed.data.records['2026-10-04']?.completedHabits).toBe(1)
    // No dia seguinte, sem revisão, ele é encerrado automaticamente.
    const later = cmd.autoCloseMissedDays(data, '2026-10-06')
    expect(later.records['2026-10-04']?.closedBy).toBe('auto')
  })

  it('tarefa confirmada na revisão conta para ontem', () => {
    let { data, task } = cmd.createTask(base(), { title: 'Dormir às 23h', priority: 'normal', dueDate: '2026-10-04' }, '2026-10-04')
    data = cmd.setTaskCompleted(data, task.id, true, '2026-10-04').data
    expect(data.tasks[0]?.completedOn).toBe('2026-10-04')
    expect(cmd.closeDay(data, '2026-10-04', 'user').data.records['2026-10-04']?.completedTasks).toBe(1)
  })

  it('editar a meta grava histórico; aplicar sugestão limpa o adiamento', () => {
    let { data, habit } = cmd.createHabit(base(), { name: 'Exercícios', category: 'health', icon: 'dumbbell', color: 'lime', schedule: { weeklyGoal: 4, days: null }, target: { amount: 30, unit: 'minutes' } }, '2026-09-01')
    data = cmd.updateHabit(data, habit.id, { ...habit, schedule: { weeklyGoal: 5, days: null } }, TODAY)
    expect(data.habits[0]?.goalHistory?.map((v) => v.schedule.weeklyGoal)).toEqual([4, 5])
    // Editar só o nome não cria versão nova.
    data = cmd.updateHabit(data, habit.id, { ...data.habits[0]!, name: 'Treino' }, TODAY)
    expect(data.habits[0]?.goalHistory).toHaveLength(2)
    data = cmd.snoozeProgression(data, habit.id, TODAY)
    expect(data.habits[0]?.progressionSnoozedUntil).toBe('2026-10-19')
    data = cmd.applyHabitGoal(data, habit.id, { schedule: { weeklyGoal: 5, days: null }, target: { amount: 35, unit: 'minutes' } }, TODAY)
    expect(data.habits[0]?.target?.amount).toBe(35)
    expect(data.habits[0]?.progressionSnoozedUntil).toBeUndefined()
  })

  it('encerra dias perdidos automaticamente', () => {
    const data = cmd.autoCloseMissedDays(base(), TODAY)
    expect(Object.keys(data.records).sort()).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(data.records['2026-10-02']?.closedBy).toBe('auto')
  })
})

describe('dados de exemplo', () => {
  it('gera histórico consistente', () => {
    const data = buildDemoData(TODAY, 'Nino')
    // Todos os dias passados encerrados, exceto ontem (aguardando revisão).
    expect(Object.keys(data.records)).toHaveLength(40)
    expect(data.records['2026-10-04']).toBeUndefined()
    expect(cmd.isPendingReview(data, '2026-10-04', TODAY)).toBe(true)
    // A rotina de guitarra gera uma sugestão de progressão.
    const guitar = data.habits.find((h) => h.name === 'Treinar guitarra')!
    expect(suggestProgression(guitar, TODAY, indexLogs(data.logs))).toMatchObject({ kind: 'increase', change: 'frequency' })
    expect(sumResource(data.ledger, 'xp')).toBeGreaterThan(1000)
    expect(data.records[TODAY]).toBeUndefined()
    expect(Object.keys(data.achievements).length).toBeGreaterThan(3)
  })
})
