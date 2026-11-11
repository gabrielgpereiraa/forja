/**
 * Integridade do histórico: ações destrutivas não alteram dias encerrados.
 * (Encerramento definitivo — sem reabertura — está em commands.test.ts.)
 */
import { describe, expect, it } from 'vitest'
import type { ISODate } from '@/domain/date'
import { sumResource } from '@/domain/gamification/engine'
import { isTaskDeleteLocked } from '@/domain/rules/task-agenda'
import { createEmptyData } from '../app-data'
import * as cmd from '../commands'

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
