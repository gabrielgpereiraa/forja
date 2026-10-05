import { describe, expect, it } from 'vitest'
import { addDays } from '@/domain/date'
import { replaySkill } from '@/domain/skills/engine'
import { createEmptyData } from '../app-data'
import * as cmd from '../commands'
import * as sk from '../skill-commands'

const TODAY = '2026-10-05' as const
const GUITAR_SKILL = { name: 'Guitarra', category: 'creative' as const, icon: 'guitar' as const, color: 'violet' as const, maintenancePerWeek: 2, sessionMinutes: 30 }

function withGuitarHabit() {
  const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-09-01')
  return cmd.createHabit(base, { name: 'Treinar guitarra', category: 'creative', icon: 'guitar', color: 'violet', schedule: { weeklyGoal: 4, days: null }, target: { amount: 30, unit: 'minutes' } }, '2026-09-01')
}

describe('habilidades na aplicação', () => {
  it('vincular um hábito importa o histórico existente com a duração', () => {
    let { data, habit } = withGuitarHabit()
    data = cmd.setHabitValue(data, habit.id, '2026-09-10', 30).data
    data = cmd.setHabitValue(data, habit.id, '2026-09-12', 45).data
    const r = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY)
    expect(r.imported).toBe(2)
    expect(r.data.skillPractices.map((p) => p.duration).sort()).toEqual([30, 45])
    expect(r.data.skillPractices.every((p) => p.sourceHabitId === habit.id)).toBe(true)
  })

  it('registrar o hábito gera prática + feedback; desfazer remove', () => {
    let { data, habit } = withGuitarHabit()
    data = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY).data
    const done = cmd.toggleHabit(data, habit.id, TODAY)
    expect(done.data.skillPractices).toHaveLength(1)
    expect(done.feedback.skills[0]).toMatchObject({ skill: { name: 'Guitarra' } })
    expect(done.feedback.skills[0]!.delta.xpGained).toBeGreaterThan(0)
    expect(done.feedback.skills[0]!.delta.conditionAfter).toBeGreaterThan(done.feedback.skills[0]!.delta.conditionBefore)
    const undone = cmd.toggleHabit(done.data, habit.id, TODAY)
    expect(undone.data.skillPractices).toHaveLength(0)
  })

  it('progresso parcial também é prática (15 de 30 min = meia sessão)', () => {
    let { data, habit } = withGuitarHabit()
    data = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY).data
    data = cmd.setHabitValue(data, habit.id, TODAY, 15).data
    expect(data.skillPractices[0]).toMatchObject({ duration: 15 })
    expect(data.logs[0]?.completed).toBe(false)
  })

  it('contribuições com peso: um hábito treina várias habilidades', () => {
    let { data, habit } = withGuitarHabit()
    const g = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY)
    const c = sk.createSkill(g.data, { ...GUITAR_SKILL, name: 'Criatividade' }, [{ habitId: habit.id, weight: 0.2 }], TODAY)
    data = cmd.toggleHabit(c.data, habit.id, TODAY).data
    const xp = (id: string) => replaySkill(data.skills.find((s) => s.id === id)!, data.skillPractices, TODAY).experience
    expect(xp(c.skill.id)).toBeCloseTo(xp(g.skill.id) * 0.2)
  })

  it('registrar prática pela habilidade usa o hábito principal (sem lançamento duplo)', () => {
    let { data, habit } = withGuitarHabit()
    const r = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY)
    const res = sk.logSkillPractice(r.data, r.skill.id, { duration: 45 }, TODAY)
    expect(res.via).toBe('habit')
    expect(res.data.logs[0]).toMatchObject({ value: 45, completed: true })
    expect(res.data.skillPractices).toHaveLength(1)
    data = sk.logSkillPractice(res.data, r.skill.id, { duration: 15 }, TODAY).data
    expect(data.logs[0]?.value).toBe(60)
  })

  it('prática avulsa (sem hábito) rende foco por minuto', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-09-01')
    const r = sk.createSkill(base, { ...GUITAR_SKILL, name: 'Programação' }, [], TODAY)
    const res = sk.logSkillPractice(r.data, r.skill.id, { duration: 30 }, TODAY)
    expect(res.via).toBe('skill')
    expect(res.feedback.focus).toBe(30)
    const removed = sk.removeSkillPractice(res.data, res.data.skillPractices[0]!.id, TODAY)
    expect(removed.skillPractices).toHaveLength(0)
    expect(removed.ledger.some((e) => e.sourceKey.startsWith('skillPractice:'))).toBe(false)
  })

  it('subir de nível gera recompensa idempotente que acompanha o nível', () => {
    const base = cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-09-01')
    let { data, skill } = sk.createSkill(base, GUITAR_SKILL, [], '2026-09-01')
    for (let i = 0; i < 6; i++) data = sk.logSkillPractice(data, skill.id, { duration: 30 }, addDays("2026-09-01", i)).data
    const level = replaySkill(skill, data.skillPractices, '2026-09-06').level
    expect(level).toBeGreaterThan(1)
    const rewards = data.ledger.filter((e) => e.sourceKey.startsWith(`skillLevel:${skill.id}:`))
    expect(rewards).toHaveLength(level - 1)
    // Remover práticas faz o nível (e a recompensa) voltar.
    for (const p of [...data.skillPractices]) data = sk.removeSkillPractice(data, p.id, '2026-09-06')
    expect(data.ledger.filter((e) => e.sourceKey.startsWith(`skillLevel:${skill.id}:`))).toHaveLength(0)
  })

  it('excluir hábito remove as práticas dele; desvincular preserva o histórico', () => {
    let { data, habit } = withGuitarHabit()
    const r = sk.createSkill(data, GUITAR_SKILL, [{ habitId: habit.id, weight: 1 }], TODAY)
    data = cmd.toggleHabit(r.data, habit.id, TODAY).data
    const unlinked = sk.setSkillLinks(data, r.skill.id, [], TODAY)
    expect(unlinked.skillPractices).toHaveLength(1)
    expect(unlinked.skillLinks).toHaveLength(0)
    const deleted = cmd.deleteHabit(data, habit.id, TODAY)
    expect(deleted.skillPractices).toHaveLength(0)
  })
})

describe('migração', () => {
  it('dados v1 (sem habilidades) ganham listas vazias', async () => {
    const { migrateData } = await import('../app-data')
    const v1 = { profile: { name: 'Nino', onboardedAt: 'x', startDate: '2026-09-01' }, habits: [], logs: [], tasks: [], records: {}, ledger: [], achievements: {} }
    const d = migrateData(v1, 1)
    expect(d).toMatchObject({ skills: [], skillPractices: [], skillLinks: [] })
    expect(d.profile.name).toBe('Nino')
  })
})
