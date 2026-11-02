/**
 * Testes de aceitação da especificação de progressão (seção 11) e das
 * decisões de produto associadas (ferrugem, versionamento, conquistas).
 */
import { describe, expect, it } from 'vitest'

import { addDays, type ISODate } from '@/domain/date'
import { sumResource } from '@/domain/gamification/engine'
import type { HabitInput } from '@/domain/models/habit'
import type { SkillPractice } from '@/domain/models/skill'
import { isMaintenancePractice, maintenanceMinimum, practiceEffort, replaySkill } from '@/domain/skills/engine'
import { createEmptyData, type AppData } from '../app-data'
import * as cmd from '../commands'
import * as sk from '../skill-commands'

// 2026-10-05 é segunda-feira.
const MON = '2026-10-05' as ISODate
const THU = '2026-10-08' as ISODate

const minutesHabit = (amount: number, extra: Partial<HabitInput> = {}): HabitInput => ({
  name: `Prática ${amount} min`,
  category: 'creative',
  icon: 'guitar',
  color: 'violet',
  schedule: { weeklyGoal: 7, days: null },
  target: { amount, unit: 'minutes' },
  ...extra,
})

const SKILL = { name: 'Guitarra', category: 'creative' as const, icon: 'guitar' as const, color: 'violet' as const, maintenancePerWeek: 2, sessionMinutes: 30 }

function setup(amount = 30, weight = 1, start: ISODate = '2026-09-01') {
  const base = cmd.completeOnboarding(createEmptyData(), 'Nino', start)
  const h = cmd.createHabit(base, minutesHabit(amount), start)
  const s = sk.createSkill(h.data, SKILL, [{ habitId: h.habit.id, weight }], start)
  return { data: s.data, habitId: h.habit.id, skill: s.skill }
}

const snapshot = (data: AppData, skillId: string, asOf: ISODate) => replaySkill(data.skills.find((s) => s.id === skillId)!, data.skillPractices, asOf)
const focus = (data: AppData) => sumResource(data.ledger, 'focus')
const xp = (data: AppData) => sumResource(data.ledger, 'xp')

describe('critério de manutenção (config)', () => {
  it('mínimo para manutenção segue a tabela da especificação', () => {
    expect([3, 10, 20, 30, 60, 120].map((m) => maintenanceMinimum(m))).toEqual([3, 5, 5, 8, 15, 30])
  })
})

describe('aceitação — Foco, evolução e manutenção', () => {
  it('1. 7 de 30 min: 7 Foco, evolução proporcional, não conta para manutenção', () => {
    const a = setup()
    const partial = cmd.setHabitValue(a.data, a.habitId, MON, 7)
    expect(focus(partial.data)).toBe(7)
    expect(partial.feedback.xp).toBe(0)
    const s7 = snapshot(partial.data, a.skill.id, MON)
    expect(s7.sessionsInWindow).toBe(0)

    const b = setup()
    const full = cmd.setHabitValue(b.data, b.habitId, MON, 30).data
    const s30 = snapshot(full, b.skill.id, MON)
    expect(s7.experience / s30.experience).toBeCloseTo(7 / 30)
    expect(s7.condition - 25).toBeCloseTo((s30.condition - 25) * (7 / 30))
  })

  it('2. 8 de 30 min: 8 Foco, evolução proporcional, conta para manutenção', () => {
    const a = setup()
    const r = cmd.setHabitValue(a.data, a.habitId, MON, 8)
    expect(focus(r.data)).toBe(8)
    expect(r.feedback.xp).toBe(0)
    expect(snapshot(r.data, a.skill.id, MON).sessionsInWindow).toBe(1)
    expect(r.data.skillPractices[0]).toMatchObject({ rulesVersion: 2, targetMinutes: 30, duration: 8 })
  })

  it('3. 30 de 30 min: 30 Foco, 20 XP de sessão, conta para manutenção', () => {
    const a = setup()
    const r = cmd.setHabitValue(a.data, a.habitId, MON, 30)
    expect(focus(r.data)).toBe(30)
    expect(r.data.ledger.filter((e) => e.ruleId === 'habit.session.xp').map((e) => e.amount)).toEqual([20])
    expect(snapshot(r.data, a.skill.id, MON).sessionsInWindow).toBe(1)
  })

  it('evolução é limitada a 1 sessão: 60 de 30 min rende o mesmo que 30', () => {
    const a = setup()
    const b = setup()
    const s60 = snapshot(cmd.setHabitValue(a.data, a.habitId, MON, 60).data, a.skill.id, MON)
    const s30 = snapshot(cmd.setHabitValue(b.data, b.habitId, MON, 30).data, b.skill.id, MON)
    expect(s60.experience).toBeCloseTo(s30.experience)
  })

  it('4. meta de 3 min, realizado 3 min: conta para manutenção', () => {
    const a = setup(3)
    const r = cmd.setHabitValue(a.data, a.habitId, MON, 3).data
    expect(snapshot(r, a.skill.id, MON).sessionsInWindow).toBe(1)
  })

  for (const weight of [0.2, 0.1]) {
    it(`${weight === 0.2 ? '5' : '6'}. peso ${weight}: duas práticas válidas em dias diferentes cumprem 2x/semana`, () => {
      const a = setup(30, weight)
      let data = cmd.setHabitValue(a.data, a.habitId, MON, 30).data
      data = cmd.setHabitValue(data, a.habitId, THU, 8).data
      const s = snapshot(data, a.skill.id, THU)
      expect(s.sessionsInWindow).toBe(2)
      expect(s.status).toBe('maintaining')
      // Até domingo (6 dias depois da segunda) não enferruja.
      const sun = snapshot(data, a.skill.id, addDays(MON, 6))
      expect(sun.history.filter((d) => d.date > THU).every((d) => d.decay === 0)).toBe(true)
      // O peso continua reduzindo a evolução.
      const full = setup(30, 1)
      let fd = cmd.setHabitValue(full.data, full.habitId, MON, 30).data
      fd = cmd.setHabitValue(fd, full.habitId, THU, 8).data
      expect(s.experience).toBeLessThan(snapshot(fd, full.skill.id, THU).experience)
    })
  }

  it('7. duas práticas válidas no mesmo dia geram um único crédito', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-09-01')
    const h1 = cmd.createHabit(base, minutesHabit(30), '2026-09-01')
    const h2 = cmd.createHabit(h1.data, minutesHabit(20, { name: 'Escalas' }), '2026-09-01')
    const s = sk.createSkill(h2.data, SKILL, [{ habitId: h1.habit.id, weight: 1 }, { habitId: h2.habit.id, weight: 0.5 }], '2026-09-01')
    let data = cmd.setHabitValue(s.data, h1.habit.id, MON, 30).data
    data = cmd.setHabitValue(data, h2.habit.id, MON, 20).data
    expect(data.skillPractices.filter((p) => p.date === MON)).toHaveLength(2)
    expect(snapshot(data, s.skill.id, MON).sessionsInWindow).toBe(1)
  })

  it('práticas abaixo do mínimo não se somam para virar crédito', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-09-01')
    const h1 = cmd.createHabit(base, minutesHabit(30), '2026-09-01')
    const h2 = cmd.createHabit(h1.data, minutesHabit(30, { name: 'Escalas' }), '2026-09-01')
    const s = sk.createSkill(h2.data, SKILL, [{ habitId: h1.habit.id, weight: 1 }, { habitId: h2.habit.id, weight: 1 }], '2026-09-01')
    let data = cmd.setHabitValue(s.data, h1.habit.id, MON, 5).data
    data = cmd.setHabitValue(data, h2.habit.id, MON, 5).data
    expect(snapshot(data, s.skill.id, MON).sessionsInWindow).toBe(0)
  })

  it('8. reduzir de 8 para 7 minutos remove a contribuição para manutenção', () => {
    const a = setup()
    const eight = cmd.setHabitValue(a.data, a.habitId, MON, 8).data
    expect(snapshot(eight, a.skill.id, MON).sessionsInWindow).toBe(1)
    const seven = cmd.setHabitValue(eight, a.habitId, MON, 7).data
    expect(snapshot(seven, a.skill.id, MON).sessionsInWindow).toBe(0)
    expect(seven.skillPractices).toHaveLength(1)
    expect(focus(seven)).toBe(7)
  })

  it('9. atualizar 15 → 30 minutos não duplica Foco nem XP', () => {
    const a = setup()
    let data = cmd.setHabitValue(a.data, a.habitId, MON, 15).data
    data = cmd.setHabitValue(data, a.habitId, MON, 30).data
    data = cmd.setHabitValue(data, a.habitId, MON, 30).data
    expect(focus(data)).toBe(30)
    expect(data.ledger.filter((e) => e.ruleId === 'habit.session.xp')).toHaveLength(1)
    expect(data.ledger.filter((e) => e.ruleId === 'habit.session.focus')).toHaveLength(1)
    // Desfazer zera tudo.
    data = cmd.setHabitValue(data, a.habitId, MON, 0).data
    expect(focus(data)).toBe(0)
    expect(data.ledger.some((e) => e.sourceKey.startsWith('habitLog:'))).toBe(false)
  })

  it('binários contam para manutenção só quando concluídos', () => {
    const p = (intensity: number): Pick<SkillPractice, 'duration' | 'intensity' | 'weight' | 'rulesVersion' | 'targetMinutes' | 'sourceHabitId'> => ({
      duration: null,
      intensity,
      weight: 0.2,
      rulesVersion: 2,
      targetMinutes: null,
      sourceHabitId: 'hb_x',
    })
    expect(isMaintenancePractice(p(1))).toBe(true)
    expect(isMaintenancePractice(p(0.5))).toBe(false)
  })

  it('meta da prática é a vigente na data (histórico de metas)', () => {
    const a = setup()
    let data = cmd.setHabitValue(a.data, a.habitId, '2026-09-29', 8).data // semana com meta 30
    data = cmd.updateHabit(data, a.habitId, minutesHabit(60), MON) // meta 60 a partir desta semana
    data = cmd.setHabitValue(data, a.habitId, MON, 14).data
    const byDate = Object.fromEntries(data.skillPractices.map((p) => [p.date, p.targetMinutes]))
    expect(byDate).toEqual({ '2026-09-29': 30, [MON]: 60 })
    const s = snapshot(data, a.skill.id, MON)
    // 8/30 vale; 14/60 não (mínimo 15).
    expect(s.history.find((d) => d.date === '2026-09-29')?.sessionsInWindow).toBe(1)
    expect(s.sessionsInWindow).toBe(1)
  })

  it('prática abaixo do mínimo não zera a inatividade (decisão: ferrugem)', () => {
    const run = (minutes: number) => {
      const a = setup()
      let data = cmd.setHabitValue(a.data, a.habitId, '2026-09-01', 30).data
      for (let d = '2026-09-02' as ISODate; d <= '2026-09-20'; d = addDays(d, 1)) data = cmd.setHabitValue(data, a.habitId, d, minutes).data
      return snapshot(data, a.skill.id, '2026-09-21')
    }
    const tiny = run(2)
    expect(tiny.history.some((d) => d.decay > 0)).toBe(true)
    expect(tiny.status).toBe('rusting')
    expect(tiny.daysSinceLast).toBe(1)
    expect(tiny.daysSinceValid).toBe(20)
    expect(run(8).history.every((d) => d.decay === 0)).toBe(true)
  })

  it('práticas v1 (anteriores) mantêm a fórmula antiga e contam para manutenção', () => {
    const legacy = { duration: 7, intensity: 1, weight: 0.2 }
    expect(practiceEffort(legacy, { sessionMinutes: 30 })).toBeCloseTo(0.25 * 0.2)
    expect(isMaintenancePractice({ ...legacy, sourceHabitId: 'hb_x' })).toBe(true)
  })
})

describe('aceitação — XP, nota e dias encerrados', () => {
  it('10. meta semanal atingida não impede XP de sessões extras', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const h = cmd.createHabit(base, { name: 'Correr', category: 'health', icon: 'footprints', color: 'lime', schedule: { weeklyGoal: 1, days: null }, target: null }, MON)
    const first = cmd.toggleHabit(h.data, h.habit.id, MON)
    expect(first.feedback.xp).toBe(70)
    const extra = cmd.toggleHabit(first.data, h.habit.id, addDays(MON, 1))
    expect(extra.feedback.xp).toBe(20)
    expect(extra.data.ledger.filter((e) => e.sourceKey.startsWith('weeklyGoal:'))).toHaveLength(1)
  })

  it('11. dia apenas com extras: nota null e sem XP de nota', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const h = cmd.createHabit(base, { name: 'Correr', category: 'health', icon: 'footprints', color: 'lime', schedule: { weeklyGoal: 1, days: null }, target: null }, MON)
    let data = cmd.toggleHabit(h.data, h.habit.id, MON).data
    data = cmd.closeDay(data, MON, 'user').data
    const tue = addDays(MON, 1)
    data = cmd.toggleHabit(data, h.habit.id, tue).data // extra: meta da semana já batida
    const closed = cmd.closeDay(data, tue, 'user')
    expect(closed.data.records[tue]?.score).toBeNull()
    expect(closed.feedback.xp).toBe(0)
    expect(closed.data.ledger.some((e) => e.sourceKey === `day:${tue}`)).toBe(false)
  })

  it('tarefa adiantada sozinha também não gera nota', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    let { data } = cmd.createTask(base, { title: 'Adiantar relatório', priority: 'normal', dueDate: addDays(MON, 3) }, MON)
    data = cmd.setTaskCompleted(data, data.tasks[0]!.id, true, MON).data
    expect(cmd.closeDay(data, MON, 'user').data.records[MON]?.score).toBeNull()
  })

  it('13. dias encerrados não mudam fora da exceção permitida', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const sleep = cmd.createHabit(base, { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }, MON)
    const read = cmd.createHabit(sleep.data, { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 7, days: null }, target: null }, MON)
    let data = read.data
    const t1 = cmd.createTask(data, { title: 'Pagar conta', priority: 'normal', dueDate: MON }, MON)
    data = t1.data
    const t2 = cmd.createTask(data, { title: 'Ligar', priority: 'normal', dueDate: MON }, MON)
    data = cmd.setTaskCompleted(t2.data, t2.task.id, true, MON).data
    data = cmd.closeDay(data, MON, 'user').data
    const same = (r: cmd.CommandResult) => expect(r.data).toBe(data)

    // Hábito comum, tarefa pendente e tarefa concluída num dia encerrado.
    same(cmd.setHabitValue(data, read.habit.id, MON, 1))
    same(cmd.toggleHabit(data, read.habit.id, MON, MON))
    same(cmd.setTaskCompleted(data, t1.task.id, true, MON, MON))
    same(cmd.setTaskCompleted(data, t2.task.id, false, addDays(MON, 1), addDays(MON, 1)))
    // Pela aba Tarefas com hoje encerrado.
    same(cmd.setTaskCompleted(data, t1.task.id, true, MON))
    // Confirmação tardia: hábito sem a flag, ou fora da janela.
    same(cmd.confirmLateHabit(data, read.habit.id, MON, addDays(MON, 1), true))
    same(cmd.confirmLateHabit(data, sleep.habit.id, MON, addDays(MON, 2), true))
    // A exceção permitida funciona.
    expect(cmd.confirmLateHabit(data, sleep.habit.id, MON, addDays(MON, 1), true).data.records[MON]?.completedHabits).toBe(1)
  })

  it('datas passadas abertas: só ontem e só hábitos com a flag', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const sleep = cmd.createHabit(base, { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }, MON)
    const read = cmd.createHabit(sleep.data, { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 7, days: null }, target: null }, MON)
    const data = read.data
    const today = addDays(MON, 2)
    const yesterday = addDays(MON, 1)
    expect(cmd.setHabitValue(data, read.habit.id, yesterday, 1, today).data).toBe(data)
    expect(cmd.setHabitValue(data, sleep.habit.id, MON, 1, today).data).toBe(data)
    expect(cmd.setHabitValue(data, sleep.habit.id, addDays(today, 1), 1, today).data).toBe(data)
    expect(cmd.setHabitValue(data, sleep.habit.id, yesterday, 1, today).data.logs).toHaveLength(1)
    expect(cmd.setHabitValue(data, read.habit.id, today, 1, today).data.logs).toHaveLength(1)
    // Tarefas não são concluídas em outra data que não hoje.
    const t = cmd.createTask(data, { title: 'Pagar conta', priority: 'normal', dueDate: yesterday }, yesterday)
    expect(cmd.setTaskCompleted(t.data, t.task.id, true, yesterday, today).data).toBe(t.data)
    expect(cmd.setTaskCompleted(t.data, t.task.id, true, today, today).data.tasks[0]?.completedOn).toBe(today)
  })
})

describe('aceitação — confirmação tardia e recompensas de habilidade', () => {
  it('12. confirmar ontem não apaga recompensas de níveis posteriores', () => {
    // Início escolhido para que a prática de hoje suba a habilidade de nível (4 → 5).
    const start = '2026-09-05' as ISODate
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', start)
    const night = cmd.createHabit(base, minutesHabit(30, { name: 'Estudo noturno', confirmNextDay: true }), start)
    const day = cmd.createHabit(night.data, minutesHabit(30, { name: 'Treino' }), start)
    const s = sk.createSkill(day.data, SKILL, [{ habitId: night.habit.id, weight: 1 }, { habitId: day.habit.id, weight: 1 }], start)
    let data = s.data
    const yesterday = '2026-10-06' as ISODate
    const today = addDays(yesterday, 1)
    for (let d = start; d <= yesterday; d = addDays(d, 1)) {
      data = cmd.setHabitValue(data, day.habit.id, d, 30).data
      data = cmd.closeDay(data, d, 'user').data
    }
    const levelYesterday = snapshot(data, s.skill.id, yesterday).level
    data = cmd.setHabitValue(data, day.habit.id, today, 30, today).data
    const levelToday = snapshot(data, s.skill.id, today).level
    expect(levelToday).toBeGreaterThan(levelYesterday)
    const rewards = (d: AppData) => d.ledger.filter((e) => e.sourceKey.startsWith(`skillLevel:${s.skill.id}:`)).length
    expect(rewards(data)).toBe(levelToday - 1)

    const confirmed = cmd.confirmLateHabit(data, night.habit.id, yesterday, today, true).data
    const levelAfter = snapshot(confirmed, s.skill.id, today).level
    expect(levelAfter).toBeGreaterThanOrEqual(levelToday)
    expect(rewards(confirmed)).toBe(levelAfter - 1)
    // Desfazer a confirmação também não perde recompensas de hoje.
    const undone = cmd.confirmLateHabit(confirmed, night.habit.id, yesterday, today, false).data
    expect(rewards(undone)).toBe(levelToday - 1)
  })
})

describe('aceitação — conquistas', () => {
  function lateSetup() {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const sleep = cmd.createHabit(base, { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }, MON)
    const read = cmd.createHabit(sleep.data, { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 7, days: null }, target: null }, MON)
    let data = cmd.toggleHabit(read.data, read.habit.id, MON).data
    data = cmd.closeDay(data, MON, 'user').data
    return { data, sleepId: sleep.habit.id }
  }

  it('14. conquistas validadas permanecem após desfazer a ação', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', MON)
    const h = cmd.createHabit(base, { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 3, days: null }, target: null }, MON)
    const done = cmd.toggleHabit(h.data, h.habit.id, MON)
    expect(done.data.achievements['first-step']).toBeDefined()
    const undone = cmd.toggleHabit(done.data, h.habit.id, MON)
    expect(xp(undone.data)).toBe(0)
    expect(undone.data.achievements['first-step']).toBeDefined()
  })

  it('conquista que depende de confirmação tardia aguarda a consolidação', () => {
    const { data, sleepId } = lateSetup()
    expect(data.records[MON]!.score!).toBeLessThan(9)
    expect(data.achievements.excellent).toBeUndefined()
    const next = addDays(MON, 1)
    const r = cmd.confirmLateHabit(data, sleepId, MON, next, true)
    expect(r.data.records[MON]!.score!).toBeGreaterThanOrEqual(9)
    expect(r.feedback.achievements.map((a) => a.id)).not.toContain('excellent')
    expect(r.data.achievements.excellent).toBeUndefined()
    // Ainda dentro da janela, outras ações não a validam.
    expect(cmd.unlockAchievements(r.data, next).data.achievements.excellent).toBeUndefined()
    // Desfazer dentro da janela: nada a remover.
    expect(cmd.confirmLateHabit(r.data, sleepId, MON, next, false).data.achievements.excellent).toBeUndefined()
    // Fechada a janela (ao abrir o app no dia seguinte), vira definitiva.
    const later = cmd.autoCloseMissedDays(r.data, addDays(MON, 2))
    expect(later.achievements.excellent).toBeDefined()
  })

  it('conquistas atingidas no encerramento não esperam (a confirmação só pode subir a nota)', () => {
    const { data } = lateSetup()
    expect(data.achievements['first-day']).toBeDefined()
  })
})

describe('aceitação — determinismo', () => {
  it('15. replay com as mesmas entradas e configuração produz o mesmo resultado', () => {
    const a = setup(30, 0.5)
    let data = a.data
    for (const [d, v] of [['2026-09-02', 8], ['2026-09-03', 30], ['2026-09-07', 7], ['2026-09-20', 45]] as const) data = cmd.setHabitValue(data, a.habitId, d, v).data
    const one = snapshot(data, a.skill.id, '2026-10-01')
    const two = snapshot(structuredClone(data), a.skill.id, '2026-10-01')
    expect(two).toEqual(one)
    expect(snapshot({ ...data, skillPractices: [...data.skillPractices].reverse() }, a.skill.id, '2026-10-01')).toEqual(one)
  })
})
