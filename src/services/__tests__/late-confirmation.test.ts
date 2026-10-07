import { describe, expect, it } from 'vitest'

import { sumResource } from '@/domain/gamification/engine'
import type { ISODate } from '@/domain/date'
import type { HabitInput } from '@/domain/models/habit'
import { computeStreak } from '@/domain/rules/streaks'
import { createEmptyData, type AppData } from '../app-data'
import * as cmd from '../commands'

// 2026-10-05 é segunda-feira.
const D = '2026-10-06' as ISODate // dia encerrado
const NEXT = '2026-10-07' as ISODate // manhã seguinte

const SLEEP: HabitInput = { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }
const READ: HabitInput = { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 7, days: null }, target: null }

function setup() {
  let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
  const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
  data = sleep.data
  const read = cmd.createHabit(data, READ, '2026-10-05')
  data = read.data
  // Segunda encerrada com tudo feito (para haver sequência).
  data = cmd.toggleHabit(data, sleep.habit.id, '2026-10-05').data
  data = cmd.toggleHabit(data, read.habit.id, '2026-10-05').data
  data = cmd.closeDay(data, '2026-10-05', 'user').data
  // Terça: lê, não marca o sono e encerra normalmente.
  data = cmd.toggleHabit(data, read.habit.id, D).data
  data = cmd.closeDay(data, D, 'user').data
  return { data, sleepId: sleep.habit.id, readId: read.habit.id }
}

describe('confirmação tardia', () => {
  it('o encerramento guarda quais hábitos aguardam confirmação', () => {
    const { data, sleepId } = setup()
    expect(data.records[D]?.awaitingConfirmation).toEqual([sleepId])
    expect(data.records[D]?.completedHabits).toBe(1)
  })

  it('na manhã seguinte confirma para o dia anterior e recalcula o dia', () => {
    const { data, sleepId } = setup()
    const before = data.records[D]!
    const xpBefore = sumResource(data.ledger, 'xp')
    const r = cmd.confirmLateHabit(data, sleepId, D, NEXT, true)
    const after = r.data.records[D]!

    expect(r.data.logs.find((l) => l.habitId === sleepId && l.date === D)?.completed).toBe(true)
    expect(after.completedHabits).toBe(2)
    expect(after.score!).toBeGreaterThan(before.score!)
    // Continua encerrado, com os mesmos dados de encerramento.
    expect(after.closedAt).toBe(before.closedAt)
    expect(after.closedBy).toBe('user')
    expect(after.awaitingConfirmation).toEqual([sleepId])
    expect(after.lateConfirmations?.map((c) => c.habitId)).toEqual([sleepId])
    // XP: sessão do hábito + nota maior + "todos os hábitos do dia".
    expect(sumResource(r.data.ledger, 'xp')).toBeGreaterThan(xpBefore)
    expect(r.feedback.xp).toBe(sumResource(r.data.ledger, 'xp') - xpBefore)
    expect(r.data.ledger.filter((e) => e.sourceKey === `day:${D}`).some((e) => e.ruleId === 'day.closed.perfect_habits')).toBe(true)
  })

  it('desfazer volta exatamente ao estado do encerramento', () => {
    const { data, sleepId } = setup()
    const confirmed = cmd.confirmLateHabit(data, sleepId, D, NEXT, true).data
    const undone = cmd.confirmLateHabit(confirmed, sleepId, D, NEXT, false).data
    expect(undone.logs.some((l) => l.habitId === sleepId && l.date === D)).toBe(false)
    expect(undone.records[D]?.score).toBe(data.records[D]?.score)
    expect(undone.records[D]?.lateConfirmations).toBeUndefined()
    expect(sumResource(undone.ledger, 'xp')).toBe(sumResource(data.ledger, 'xp'))
  })

  it('demais hábitos e o restante do dia continuam bloqueados', () => {
    const { data, readId } = setup()
    expect(cmd.confirmLateHabit(data, readId, D, NEXT, false).data).toBe(data)
    expect(cmd.toggleHabit(data, readId, D).data).toBe(data)
    // Hábito sem a flag (desmarcado) também não pode ser confirmado.
    const unread = { ...data, logs: data.logs.filter((l) => !(l.habitId === readId && l.date === D)) }
    expect(cmd.confirmLateHabit(unread, readId, D, NEXT, true).data).toBe(unread)
  })

  it('a confirmação normal (toggle) continua bloqueada no dia encerrado', () => {
    const { data, sleepId } = setup()
    expect(cmd.toggleHabit(data, sleepId, D).data).toBe(data)
  })

  it('fora da janela (depois da manhã seguinte) não confirma mais', () => {
    const { data, sleepId } = setup()
    expect(cmd.confirmLateHabit(data, sleepId, D, '2026-10-08', true).data).toBe(data)
    // Nem no próprio dia.
    expect(cmd.confirmLateHabit(data, sleepId, D, D, true).data).toBe(data)
  })

  it('ligar a flag depois do encerramento não libera o hábito', () => {
    const { data, readId } = setup()
    const unread = { ...data, logs: data.logs.filter((l) => !(l.habitId === readId && l.date === D)) }
    const flagged = cmd.updateHabit(unread, readId, { ...READ, confirmNextDay: true }, NEXT)
    expect(cmd.confirmLateHabit(flagged, readId, D, NEXT, true).data).toBe(flagged)
  })

  it('registros antigos (sem a lista) usam a flag atual', () => {
    const { data, sleepId } = setup()
    const { awaitingConfirmation: _, ...legacy } = data.records[D]!
    void _
    const old = { ...data, records: { ...data.records, [D]: legacy } }
    const r = cmd.confirmLateHabit(old, sleepId, D, NEXT, true)
    expect(r.data.records[D]?.completedHabits).toBe(2)
    expect(r.data.records[D]?.awaitingConfirmation).toEqual([sleepId])
  })

  it('confirmar recupera a sequência quebrada por ontem e recalcula hoje já encerrado', () => {
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
    const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
    data = cmd.toggleHabit(sleep.data, sleep.habit.id, '2026-10-05').data
    data = cmd.closeDay(data, '2026-10-05', 'user').data
    data = cmd.closeDay(data, D, 'user').data // só o sono, desmarcado → nota baixa
    data = cmd.toggleHabit(data, sleep.habit.id, NEXT).data
    data = cmd.closeDay(data, NEXT, 'user').data
    expect(computeStreak(data.records, NEXT).current).toBe(1)

    const r = cmd.confirmLateHabit(data, sleep.habit.id, D, NEXT, true)
    expect(computeStreak(r.data.records, NEXT).current).toBe(3)
    expect(r.feedback.streak).toBe(3)
  })

  it('dia vazio encerrado sozinho ainda permite confirmar o hábito opcional', () => {
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
    const once = cmd.createHabit(data, { ...SLEEP, schedule: { weeklyGoal: 1, days: null } }, '2026-10-05')
    data = cmd.toggleHabit(once.data, once.habit.id, '2026-10-05').data
    data = cmd.closeDay(data, '2026-10-05', 'user').data
    // Terça: meta da semana já batida → opcional → dia vazio → encerrado sozinho.
    data = cmd.autoCloseMissedDays(data, NEXT)
    expect(data.records[D]?.closedBy).toBe('auto')
    expect(data.records[D]?.awaitingConfirmation).toEqual([once.habit.id])

    const r = cmd.confirmLateHabit(data, once.habit.id, D, NEXT, true)
    expect(r.data.logs.some((l) => l.habitId === once.habit.id && l.date === D && l.completed)).toBe(true)
    expect(r.data.records[D]?.closedBy).toBe('auto')
  })
})
