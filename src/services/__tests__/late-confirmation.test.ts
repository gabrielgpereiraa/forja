import { describe, expect, it } from 'vitest'

import { sumResource } from '@/domain/gamification/engine'
import type { ISODate } from '@/domain/date'
import type { HabitInput } from '@/domain/models/habit'
import { buildDayOverview } from '@/domain/rules/day-overview'
import { indexLogs } from '@/domain/rules/habit-schedule'
import { habitsForMorningReview } from '@/domain/rules/late-confirmation'
import { computeStreak } from '@/domain/rules/streaks'
import { CURRENT_SCORING, SCORING_STRATEGIES, type ScoringStrategy } from '@/domain/scoring'
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

  it('revisão da manhã (dia aberto) lista só hábitos com a flag, mesmo com outros pendentes', () => {
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
    const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
    const read = cmd.createHabit(sleep.data, READ, '2026-10-05')
    data = read.data // nenhum dos dois foi marcado em D: ambos obrigatórios e pendentes
    const overview = buildDayOverview({ date: D, habits: data.habits, logs: indexLogs(data.logs), tasks: data.tasks, record: null })
    expect(overview.plannedHabits.some((s) => s.habit.id === read.habit.id && !s.doneToday)).toBe(true)
    expect(habitsForMorningReview(overview).map((s) => s.habit.id)).toEqual([sleep.habit.id])
  })

  describe('quando o dia foi encerrado', () => {
    function openTuesday() {
      let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
      const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
      const read = cmd.createHabit(sleep.data, READ, '2026-10-05')
      data = cmd.toggleHabit(read.data, read.habit.id, D).data // lê; o sono fica desmarcado
      return { data, sleepId: sleep.habit.id }
    }

    it('à noite, no próprio dia: abre a janela da manhã seguinte', () => {
      const { data, sleepId } = openTuesday()
      const closed = cmd.closeDay(data, D, 'user', D).data
      expect(closed.records[D]?.awaitingConfirmation).toEqual([sleepId])
      expect(cmd.confirmLateHabit(closed, sleepId, D, NEXT, true).data.records[D]?.lateConfirmations).toHaveLength(1)
    })

    it('pela revisão da manhã: o desmarcado conta como não cumprido, sem segunda chance', () => {
      const { data, sleepId } = openTuesday()
      const closed = cmd.closeDay(data, D, 'user', NEXT).data
      expect(closed.records[D]?.awaitingConfirmation).toEqual([])
      const r = cmd.confirmLateHabit(closed, sleepId, D, NEXT, true)
      expect(r.data).toBe(closed)
      expect(r.data.logs.some((l) => l.habitId === sleepId && l.date === D && l.completed)).toBe(false)
    })

    it('marcado na revisão antes de encerrar: conta para ontem normalmente', () => {
      const { data, sleepId } = openTuesday()
      const marked = cmd.toggleHabit(data, sleepId, D, NEXT).data
      const closed = cmd.closeDay(marked, D, 'user', NEXT).data
      expect(closed.records[D]?.completedHabits).toBe(2)
      expect(closed.records[D]?.awaitingConfirmation).toEqual([])
    })
  })

  describe('versão da nota', () => {
    /** Estratégia fictícia, só para provar qual versão o recálculo usa. */
    const FAKE: ScoringStrategy = {
      version: 'v-teste',
      label: 'Estratégia de teste',
      compute: () => ({ version: 'v-teste', score: 7.7, base: 7.7, components: [], adjustments: [], completion: 0.77, highlights: [] }),
    }
    function withVersion(data: AppData, version: string | undefined): AppData {
      const record = data.records[D]!
      const breakdown = { ...record.breakdown, version } as typeof record.breakdown
      return { ...data, records: { ...data.records, [D]: { ...record, breakdown } } }
    }

    it('encerrar usa a estratégia ativa e grava a versão', () => {
      const { data } = setup()
      expect(data.records[D]?.breakdown.version).toBe(CURRENT_SCORING.version)
    })

    it('a confirmação recalcula com a versão do registro, não com a ativa', () => {
      SCORING_STRATEGIES[FAKE.version] = FAKE
      try {
        const { data, sleepId } = setup()
        const r = cmd.confirmLateHabit(withVersion(data, FAKE.version), sleepId, D, NEXT, true)
        expect(CURRENT_SCORING.version).not.toBe(FAKE.version)
        expect(r.data.records[D]?.breakdown.version).toBe(FAKE.version)
        expect(r.data.records[D]?.score).toBe(7.7)
        // Desfazer também usa a versão do registro.
        const undone = cmd.confirmLateHabit(r.data, sleepId, D, NEXT, false)
        expect(undone.data.records[D]?.breakdown.version).toBe(FAKE.version)
      } finally {
        delete SCORING_STRATEGIES[FAKE.version]
      }
    })

    it('registro sem versão explícita é tratado como v1', () => {
      const { data, sleepId } = setup()
      const legacy = withVersion(data, undefined)
      const r = cmd.confirmLateHabit(legacy, sleepId, D, NEXT, true)
      expect(r.data.records[D]?.breakdown.version).toBe('v1')
      expect(r.data.records[D]?.completedHabits).toBe(2)
    })

    it('versão desconhecida: a confirmação é recusada e nada muda', () => {
      const { data, sleepId } = setup()
      const unknown = withVersion(data, 'v99')
      const r = cmd.confirmLateHabit(unknown, sleepId, D, NEXT, true)
      expect(r.data).toBe(unknown)
      expect(r.data.logs.some((l) => l.habitId === sleepId && l.date === D)).toBe(false)
    })
  })

  describe('retrato do encerramento (scoringSnapshot)', () => {
    /** Terça com uma tarefa normal pendente; lê, não marca o sono e encerra à noite. */
    function closedWithTask() {
      let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
      const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
      const read = cmd.createHabit(sleep.data, READ, '2026-10-05')
      const task = cmd.createTask(read.data, { title: 'Relatório confidencial', dueDate: D, priority: 'normal' }, '2026-10-05')
      data = cmd.toggleHabit(task.data, read.habit.id, D).data
      data = cmd.closeDay(data, D, 'user', D).data
      return { data, sleepId: sleep.habit.id, readId: read.habit.id, taskId: task.task.id }
    }
    const dayXp = (d: AppData) => sumResource(d.ledger.filter((e) => e.sourceKey === `day:${D}`), 'xp')
    const confirm = (d: AppData, sleepId: string) => cmd.confirmLateHabit(d, sleepId, D, NEXT, true).data

    it('encerrar guarda só ids e campos da nota, sem textos', () => {
      const { data, sleepId, readId, taskId } = closedWithTask()
      const snap = data.records[D]!.scoringSnapshot!
      expect(snap.habits.map((h) => h.habitId)).toEqual([sleepId, readId])
      expect(snap.habits[1]).toEqual({ habitId: readId, requirement: 'required', doneToday: true, sessionProgress: 1, week: { done: 1, expectedByToday: 2 } })
      expect(snap.tasks).toEqual([{ taskId, role: 'due', doneOnDay: false, task: { priority: 'normal' } }])
      expect(JSON.stringify(snap)).not.toContain('Relatório')
      expect(JSON.stringify(snap)).not.toContain('Dormir')
    })

    it('sem mudanças, o retrato dá o mesmo resultado que o recálculo antigo', () => {
      const { data, sleepId } = closedWithTask()
      const viaSnapshot = confirm(data, sleepId).records[D]!
      const legacy = { ...data.records[D]! }
      delete legacy.scoringSnapshot
      const viaLegacy = confirm({ ...data, records: { ...data.records, [D]: legacy } }, sleepId).records[D]!
      expect(viaSnapshot.score).toBe(viaLegacy.score)
      expect(viaSnapshot.breakdown).toEqual(viaLegacy.breakdown)
      expect(viaSnapshot.completedHabits).toBe(viaLegacy.completedHabits)
    })

    const changes: [string, (d: AppData, ids: { readId: string; taskId: string }) => AppData][] = [
      ['tarefa pendente remarcada para amanhã', (d, { taskId }) => cmd.updateTask(d, taskId, { title: 'Relatório confidencial', dueDate: '2026-10-08', priority: 'normal' })],
      ['tarefa pendente excluída', (d, { taskId }) => cmd.deleteTask(d, taskId).data],
      ['prioridade alterada', (d, { taskId }) => cmd.updateTask(d, taskId, { title: 'Relatório confidencial', dueDate: D, priority: 'low' })],
      ['tarefa nova criada com data de ontem', (d) => cmd.createTask(d, { title: 'Nova', dueDate: D, priority: 'high' }, NEXT).data],
      ['meta do hábito alterada nesta semana', (d, { readId }) => cmd.updateHabit(d, readId, { ...READ, schedule: { weeklyGoal: 1, days: null } }, NEXT)],
    ]

    it.each(changes)('%s depois do encerramento não altera o resultado da confirmação', (_label, change) => {
      const { data, sleepId, readId, taskId } = closedWithTask()
      const reference = confirm(data, sleepId)
      const changed = confirm(change(data, { readId, taskId }), sleepId)
      const ref = reference.records[D]!
      const got = changed.records[D]!
      expect(got.score).toBe(ref.score)
      expect(got.breakdown).toEqual(ref.breakdown)
      expect([got.completedHabits, got.totalHabits, got.completedTasks, got.totalTasks]).toEqual([ref.completedHabits, ref.totalHabits, ref.completedTasks, ref.totalTasks])
      expect(dayXp(changed)).toBe(dayXp(reference))
      expect(computeStreak(changed.records, NEXT).current).toBe(computeStreak(reference.records, NEXT).current)
    })

    it.each(changes)('desfazer após "%s" volta exatamente ao registro do encerramento', (_label, change) => {
      const { data, sleepId, readId, taskId } = closedWithTask()
      const original = data.records[D]!
      const changed = change(data, { readId, taskId })
      const undone = cmd.confirmLateHabit(confirm(changed, sleepId), sleepId, D, NEXT, false).data
      expect(undone.records[D]).toEqual(original)
      expect(dayXp(undone)).toBe(dayXp(data))
    })

    it('a confirmação muda só o hábito confirmado no retrato recalculado', () => {
      const { data, sleepId } = closedWithTask()
      const before = data.records[D]!
      const after = confirm(data, sleepId).records[D]!
      expect(after.scoringSnapshot).toEqual(before.scoringSnapshot) // o retrato do encerramento é imutável
      expect(after.completedHabits).toBe(before.completedHabits + 1)
      expect(after.score!).toBeGreaterThan(before.score!)
      expect([after.completedTasks, after.totalTasks, after.closedAt, after.closedBy]).toEqual([before.completedTasks, before.totalTasks, before.closedAt, before.closedBy])
    })

    it('registro antigo (sem retrato) continua confirmável e não ganha retrato montado depois', () => {
      const { data, sleepId } = closedWithTask()
      const legacy = { ...data.records[D]! }
      delete legacy.scoringSnapshot
      const r = confirm({ ...data, records: { ...data.records, [D]: legacy } }, sleepId)
      expect(r.records[D]?.completedHabits).toBe(2)
      expect(r.records[D]?.scoringSnapshot).toBeUndefined()
    })
  })

  describe('múltiplas confirmações no mesmo dia', () => {
    const SCREENS: HabitInput = { name: 'Sem telas após 22h', category: 'health', icon: 'moon', color: 'violet', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }

    /** Terça: lê; sono e telas (ambos com a flag) ficam em aberto; uma tarefa pendente; encerrado à noite. */
    function twoPending() {
      let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-05')
      const sleep = cmd.createHabit(data, SLEEP, '2026-10-05')
      const screens = cmd.createHabit(sleep.data, SCREENS, '2026-10-05')
      const read = cmd.createHabit(screens.data, READ, '2026-10-05')
      const task = cmd.createTask(read.data, { title: 'Relatório', dueDate: D, priority: 'normal' }, '2026-10-05')
      data = cmd.toggleHabit(task.data, read.habit.id, D).data
      data = cmd.closeDay(data, D, 'user', D).data
      return { data, a: sleep.habit.id, b: screens.habit.id, taskId: task.task.id }
    }
    const confirm = (d: AppData, id: string, done = true) => cmd.confirmLateHabit(d, id, D, NEXT, done).data
    const dayXp = (d: AppData) => sumResource(d.ledger.filter((e) => e.sourceKey === `day:${D}`), 'xp')
    const doneOn = (d: AppData, id: string) => d.logs.some((l) => l.habitId === id && l.date === D && l.completed)
    const withoutTimes = (d: AppData) => {
      const r = d.records[D]!
      return { ...r, lateConfirmations: r.lateConfirmations?.map((c) => ({ habitId: c.habitId, previousValue: c.previousValue })) }
    }

    it('os dois hábitos aguardam confirmação e o retrato registra ambos em aberto', () => {
      const { data, a, b } = twoPending()
      expect(data.records[D]?.awaitingConfirmation).toEqual([a, b])
      const snap = data.records[D]!.scoringSnapshot!
      expect(snap.habits.filter((h) => h.habitId === a || h.habitId === b).every((h) => !h.doneToday)).toBe(true)
    })

    it.each([
      ['desfazer o primeiro', 'first'],
      ['desfazer o segundo', 'second'],
    ] as const)('confirmar A e B e %s preserva a outra confirmação, nota, XP, sequência e retrato', (_label, which) => {
      const { data, a, b } = twoPending()
      const original = data.records[D]!
      const both = confirm(confirm(data, a), b)
      expect(both.records[D]?.lateConfirmations?.map((c) => c.habitId)).toEqual([a, b])
      expect(both.records[D]?.completedHabits).toBe(original.completedHabits + 2)

      const [undo, keep] = which === 'first' ? [a, b] : [b, a]
      const after = confirm(both, undo, false)
      // Referência: só o hábito mantido confirmado, a partir do encerramento.
      const reference = confirm(data, keep)

      expect(withoutTimes(after)).toEqual(withoutTimes(reference))
      expect(after.records[D]?.scoringSnapshot).toEqual(original.scoringSnapshot)
      expect(after.records[D]?.lateConfirmations?.map((c) => c.habitId)).toEqual([keep])
      expect(doneOn(after, keep)).toBe(true)
      expect(doneOn(after, undo)).toBe(false)
      expect(dayXp(after)).toBe(dayXp(reference))
      expect(sumResource(after.ledger, 'xp')).toBe(sumResource(reference.ledger, 'xp'))
      expect(sumResource(after.ledger, 'focus')).toBe(sumResource(reference.ledger, 'focus'))
      expect(computeStreak(after.records, NEXT).current).toBe(computeStreak(reference.records, NEXT).current)
      // O que ficou confirmado ainda pode ser desfeito; o desfeito pode ser confirmado de novo.
      expect(cmd.confirmLateHabit(after, keep, D, NEXT, false).data).not.toBe(after)
      expect(confirm(after, undo).records[D]?.score).toBe(both.records[D]?.score)
    })

    it('desfazer os dois (em qualquer ordem) volta exatamente ao encerramento', () => {
      const { data, a, b } = twoPending()
      const both = confirm(confirm(data, a), b)
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const undone = confirm(confirm(both, x, false), y, false)
        expect(undone.records[D]).toEqual(data.records[D])
        expect(undone.logs).toEqual(data.logs)
        expect(sumResource(undone.ledger, 'xp')).toBe(sumResource(data.ledger, 'xp'))
        expect(sumResource(undone.ledger, 'focus')).toBe(sumResource(data.ledger, 'focus'))
      }
    })

    it('remarcar a tarefa entre as confirmações não altera o resultado', () => {
      const { data, a, b, taskId } = twoPending()
      const reference = confirm(confirm(data, a), b)
      const moved = cmd.updateTask(confirm(data, a), taskId, { title: 'Relatório', dueDate: '2026-10-08', priority: 'normal' })
      const after = confirm(moved, b)
      expect(after.records[D]?.score).toBe(reference.records[D]?.score)
      expect(after.records[D]?.breakdown).toEqual(reference.records[D]?.breakdown)
      expect(dayXp(after)).toBe(dayXp(reference))
    })
  })
})
