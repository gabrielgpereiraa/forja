import { describe, expect, it } from 'vitest'
import { buildDayOverview } from '../rules/day-overview'
import { indexLogs } from '../rules/habit-schedule'
import { getTasksForDay } from '../rules/task-agenda'
import { habit, log, task } from './fixtures'

const D = '2026-10-05' as const

describe('agenda de tarefas', () => {
  it('inclui previstas, atrasadas e adiantadas', () => {
    const items = getTasksForDay(
      [
        task({ id: 'due' }),
        task({ id: 'late', dueDate: '2026-10-03' }),
        task({ id: 'early', dueDate: '2026-10-09', completed: true, completedOn: D }),
        task({ id: 'future', dueDate: '2026-10-09' }),
        task({ id: 'oldDone', dueDate: '2026-10-02', completed: true, completedOn: '2026-10-02' }),
      ],
      D,
    )
    expect(items.map((i) => `${i.task.id}:${i.role}`).sort()).toEqual(['due:due', 'early:bonus', 'late:overdue'])
    expect(items.find((i) => i.task.id === 'late')?.daysLate).toBe(2)
  })
})

describe('nota diária v1', () => {
  it('dia vazio não tem nota', () => {
    const o = buildDayOverview({ date: D, habits: [], logs: indexLogs([]), tasks: [], record: null })
    expect(o.breakdown.score).toBeNull()
    expect(o.phase).toBe('empty')
  })

  it('dia perfeito chega a 10 com bônus limitado', () => {
    const h = habit({ id: 'p' })
    const o = buildDayOverview({
      date: D,
      habits: [h],
      logs: indexLogs([log('p', D)]),
      tasks: [task({ completed: true, completedOn: D })],
      record: null,
    })
    expect(o.breakdown.score).toBe(10)
    expect(o.phase).toBe('all_done')
    expect(o.breakdown.adjustments.some((a) => a.id === 'all-habits')).toBe(true)
  })

  it('é explicável e ponderado por prioridade', () => {
    const h1 = habit({ id: 'a' })
    const h2 = habit({ id: 'b' })
    const o = buildDayOverview({
      date: D,
      habits: [h1, h2],
      logs: indexLogs([log('a', D)]),
      tasks: [task({ priority: 'high', completed: true, completedOn: D }), task({ priority: 'low' })],
      record: null,
    })
    const tasks = o.breakdown.components.find((c) => c.id === 'tasks')!
    expect(tasks.ratio).toBeCloseTo(2 / 2.5)
    // habits 0.5*5 + tasks 0.8*4 + rhythm 0.5*1 = 6.2 / 10 → 6.2
    expect(o.breakdown.base).toBe(6.2)
    expect(o.breakdown.highlights).toContain('1 de 2 hábitos concluídos')
    expect(o.progress).toBeCloseTo(0.5)
  })

  it('aplica penalidade por tarefa atrasada', () => {
    const o = buildDayOverview({
      date: D,
      habits: [],
      logs: indexLogs([]),
      tasks: [task({ completed: true, completedOn: D }), task({ dueDate: '2026-10-01' })],
      record: null,
    })
    expect(o.breakdown.adjustments.find((a) => a.id === 'overdue')?.value).toBe(-0.15)
    expect(o.breakdown.score).toBe(4.9)
  })
})
