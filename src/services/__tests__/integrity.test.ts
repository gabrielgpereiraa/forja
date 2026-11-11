/**
 * Integridade do histórico: ações destrutivas não alteram dias encerrados.
 * (Encerramento definitivo — sem reabertura — está em commands.test.ts.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ISODate } from '@/domain/date'
import { sumResource } from '@/domain/gamification/engine'
import { isTaskDeleteLocked } from '@/domain/rules/task-agenda'
import { replaySkill } from '@/domain/skills/engine'
import { createEmptyData } from '../app-data'
import * as cmd from '../commands'
import * as sk from '../skill-commands'

const D1: ISODate = '2026-10-05'
const D2: ISODate = '2026-10-06'

function base() {
  return cmd.completeOnboarding(createEmptyData(), 'Nino', '2026-10-01')
}

function withTask(dueDate: ISODate, title = 'Limpar tênis') {
  const { data, task } = cmd.createTask(base(), { title, priority: 'normal', dueDate }, '2026-10-01')
  return { data, id: task.id }
}

describe('exclusão de tarefas e dias encerrados', () => {
  it('tarefa concluída em dia encerrado não pode ser excluída (nada muda)', () => {
    let { data, id } = withTask(D1)
    data = cmd.setTaskCompleted(data, id, true, D1).data
    data = cmd.closeDay(data, D1, 'user').data
    expect(isTaskDeleteLocked(data.tasks[0]!, data.records)).toBe(true)
    const r = cmd.deleteTask(data, id)
    expect(r.removed).toBeNull()
    expect(r.entries).toEqual([])
    expect(r.data).toBe(data) // mesma referência: XP, registros e histórico intactos
    expect(sumResource(r.data.ledger, 'xp')).toBe(sumResource(data.ledger, 'xp'))
  })

  it('tarefa pendente (atrasada) segue excluível sem alterar o dia encerrado', () => {
    let { data, id } = withTask('2026-10-04')
    data = cmd.closeDay(data, D1, 'user').data // a tarefa entra no retrato como atrasada
    const record = data.records[D1]!
    expect(record.scoringSnapshot?.tasks.some((t) => t.taskId === id && t.role === 'overdue')).toBe(true)
    const xp = sumResource(data.ledger, 'xp')
    const r = cmd.deleteTask(data, id)
    expect(r.removed?.id).toBe(id)
    expect(r.data.tasks).toHaveLength(0)
    expect(r.data.records[D1]).toBe(record) // nota e retrato do encerramento não mudam
    expect(sumResource(r.data.ledger, 'xp')).toBe(xp)
  })

  it('tarefa concluída em dia aberto segue excluível e o desfazer restaura o XP', () => {
    let { data, id } = withTask(D2)
    data = cmd.closeDay(data, D1, 'user').data
    data = cmd.setTaskCompleted(data, id, true, D2).data
    const xp = sumResource(data.ledger, 'xp')
    const r = cmd.deleteTask(data, id)
    expect(r.removed?.id).toBe(id)
    expect(sumResource(r.data.ledger, 'xp')).toBe(xp - 10)
    const restored = cmd.restoreTask(r.data, r.removed!, r.entries)
    expect(sumResource(restored.ledger, 'xp')).toBe(xp)
  })

  it('ao encerrar o dia, a tarefa concluída nele passa a ser protegida', () => {
    let { data, id } = withTask(D1)
    data = cmd.setTaskCompleted(data, id, true, D1).data
    expect(cmd.deleteTask(data, id).removed).not.toBeNull()
    data = cmd.closeDay(data, D1, 'user').data
    expect(cmd.deleteTask(data, id).removed).toBeNull()
  })
})

const SKILL = { name: 'Desenho', category: 'creative' as const, icon: 'guitar' as const, color: 'violet' as const, maintenancePerWeek: 2, sessionMinutes: 30 }

/** Habilidade sem hábito vinculado + uma prática avulsa de 30 min em `date`. */
function withLoosePractice(date: ISODate) {
  const { data: d0, skill } = sk.createSkill(base(), SKILL, [], '2026-10-01')
  const res = sk.logSkillPractice(d0, skill.id, { duration: 30 }, date)
  expect(res.via).toBe('skill')
  const practice = res.data.skillPractices[0]!
  expect(practice.sourceLogId).toBeNull()
  return { data: res.data, skill, practice }
}

describe('práticas e habilidades com histórico em dias encerrados', () => {
  afterEach(() => vi.useRealTimers())

  it('prática avulsa de dia encerrado não pode ser removida (Foco e progressão intactos)', () => {
    let { data, practice } = withLoosePractice(D1)
    data = cmd.closeDay(data, D1, 'user').data
    expect(sumResource(data.ledger, 'focus')).toBe(30)
    expect(sk.isPracticeLocked(data.records, practice, D2)).toBe(true)
    expect(sk.removeSkillPractice(data, practice.id, D2)).toBe(data)
    expect(sk.removeSkillPractice(data, practice.id, D1)).toBe(data) // registrada antes do encerramento
  })

  it('prática avulsa de dia aberto segue removível', () => {
    const { data, practice } = withLoosePractice(D1)
    const removed = sk.removeSkillPractice(data, practice.id, D1)
    expect(removed.skillPractices).toHaveLength(0)
    expect(sumResource(removed.ledger, 'focus')).toBe(0)
  })

  it('prática registrada depois do encerramento de hoje pode ser desfeita só no mesmo dia', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-05T22:00:00Z'))
    const { data: d0, skill } = sk.createSkill(base(), SKILL, [], '2026-10-01')
    const closed = cmd.closeDay(d0, D1, 'user').data
    vi.setSystemTime(new Date('2026-10-05T23:00:00Z'))
    const data = sk.logSkillPractice(closed, skill.id, { duration: 30 }, D1).data
    const practice = data.skillPractices[0]!
    expect(sk.isPracticeLocked(data.records, practice, D1)).toBe(false)
    expect(sk.removeSkillPractice(data, practice.id, D1).skillPractices).toHaveLength(0)
    // No dia seguinte, passa a ser histórico.
    expect(sk.removeSkillPractice(data, practice.id, D2)).toBe(data)
  })

  it('habilidade com prática em dia encerrado não pode ser excluída; arquivar preserva tudo', () => {
    let { data, skill } = withLoosePractice(D1)
    data = cmd.closeDay(data, D1, 'user').data
    expect(sk.skillHasClosedHistory(data, skill.id, D2)).toBe(true)
    expect(sk.deleteSkill(data, skill.id, D2)).toBe(data)
    expect(sk.deleteSkill(data, skill.id)).toBe(data) // sem `today`: também protegida
    const before = replaySkill(data.skills[0]!, data.skillPractices, D2)
    const archived = sk.setSkillArchived(data, skill.id, true)
    expect(archived.skills[0]!.archived).toBe(true)
    expect(archived.skillPractices).toEqual(data.skillPractices)
    expect(archived.ledger).toEqual(data.ledger)
    const after = replaySkill(archived.skills[0]!, archived.skillPractices, D2)
    expect(after.experience).toBe(before.experience)
    expect(after.level).toBe(before.level)
  })

  it('habilidade só com práticas de dia aberto segue excluível', () => {
    const { data, skill } = withLoosePractice(D1)
    const deleted = sk.deleteSkill(data, skill.id, D1)
    expect(deleted.skills).toHaveLength(0)
    expect(deleted.skillPractices).toHaveLength(0)
    expect(sumResource(deleted.ledger, 'focus')).toBe(0)
  })

  it('prática vinda de hábito em dia encerrado também protege a habilidade', () => {
    const b = cmd.createHabit(base(), { name: 'Desenhar', category: 'creative', icon: 'guitar', color: 'violet', schedule: { weeklyGoal: 3, days: null }, target: { amount: 30, unit: 'minutes' } }, '2026-10-01')
    const { data: d0, skill } = sk.createSkill(b.data, SKILL, [{ habitId: b.habit.id, weight: 1 }], '2026-10-01')
    let data = cmd.setHabitValue(d0, b.habit.id, D1, 30).data
    data = cmd.closeDay(data, D1, 'user').data
    expect(data.skillPractices[0]?.sourceLogId).not.toBeNull()
    expect(sk.deleteSkill(data, skill.id, D2)).toBe(data)
  })
})
