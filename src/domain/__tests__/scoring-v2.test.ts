/**
 * Nota v2 — casos numéricos e propriedades de aceitação da especificação
 * ("Forja — Especificação da nota do dia v2", decisões 1 a 5 aprovadas).
 */
import { describe, expect, it } from 'vitest'

import type { TaskPriority } from '@/domain/models/task'
import { scoringV2, taskCapFactor, type ScoreBreakdown, type ScoringHabit, type ScoringInput, type ScoringTask } from '@/domain/scoring'

const D = '2026-11-10' as const
let seq = 0
const habit = (progress: number, required = true, week = { done: 0, expectedByToday: 0 }): ScoringHabit => ({
  habitId: `h${++seq}`,
  requirement: required ? 'required' : 'optional',
  doneToday: progress >= 1,
  sessionProgress: progress,
  week,
})
const task = (priority: TaskPriority, done: boolean, role: ScoringTask['role'] = 'due'): ScoringTask => ({
  taskId: `t${++seq}`,
  role,
  doneOnDay: done,
  task: { priority },
})
const many = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i))
const score = (habits: ScoringHabit[], tasks: ScoringTask[]) => scoringV2.compute({ date: D, habits, tasks })
const sumValues = (b: ScoreBreakdown, roles: string[]) => (b.items ?? []).filter((i) => roles.includes(i.role)).reduce((s, i) => s + i.value, 0)
const valueOf = (b: ScoreBreakdown, id: string | null | undefined) => b.items!.find((i) => i.id === id)!.value

describe('nota v2 — casos numéricos da especificação', () => {
  it('1. 5 hábitos e 1 tarefa normal', () => {
    expect(score(many(5, () => habit(1)), [task('normal', false)]).score).toBe(8.6) // 8,3 + 0,3
    expect(score(many(5, () => habit(1)), [task('normal', true)]).score).toBe(10)
    const onlyTask = score(many(5, () => habit(0)), [task('normal', true)])
    expect(onlyTask.score).toBe(1.7)
    expect(onlyTask.items!.filter((i) => i.role !== 'optional').every((i) => Math.abs(i.value - 10 / 6) < 1e-9)).toBe(true)
  })

  it('2. 5 hábitos e 10 tarefas normais: teto de 50%', () => {
    const tasks = (done: number) => many(10, (i) => task('normal', i < done))
    expect(score(many(5, () => habit(1)), tasks(0)).score).toBe(5.3) // 5,0 + 0,3
    expect(score(many(5, () => habit(0)), tasks(10)).score).toBe(5)
    expect(score(many(5, () => habit(1)), tasks(5)).score).toBe(7.8) // 7,5 + 0,3
    expect(score(many(5, (i) => habit(i < 3 ? 1 : 0)), tasks(8)).score).toBe(7)
    expect(score(many(5, () => habit(1)), tasks(10)).score).toBe(10)
    const b = score(many(5, () => habit(0)), tasks(0))
    expect(b.taskCap).toEqual({ k: 0.5, active: true })
    expect(b.items!.find((i) => i.role === 'required')!.value).toBeCloseTo(1, 9)
    expect(b.items!.find((i) => i.role === 'due')!.value).toBeCloseTo(0.5, 9)
  })

  it('3. só tarefas (1 alta, 2 normais, 1 baixa), alta e baixa feitas: 5,6, tarefas valem 100%, sem +0,3', () => {
    const b = score([], [task('high', true), task('normal', false), task('normal', false), task('low', true)])
    expect(b.score).toBe(5.6)
    expect(b.taskCap!.active).toBe(false)
    expect(b.adjustments).toEqual([])
    expect(b.items!.map((i) => Math.round(i.value * 10) / 10)).toEqual([4.4, 2.2, 2.2, 1.1])
  })

  it('4. prioridades diferentes, com e sem o teto ativo', () => {
    const a = score(many(4, () => habit(1)), [task('high', true), task('low', false)])
    expect(a.score).toBe(9.5) // 9,2 + 0,3; T = 2,5 ≤ H = 4: sem teto
    expect(a.taskCap!.active).toBe(false)
    const high = task('high', true)
    const normal = task('normal', false)
    const b = score(many(2, () => habit(1)), [high, task('high', false), normal])
    expect(b.score).toBe(7.3) // 7,0 + 0,3; T = 5 > H = 2: k = 0,4
    expect(b.taskCap!.k).toBeCloseTo(0.4, 9)
    expect(b.items!.find((i) => i.role === 'required')!.value).toBeCloseTo(2.5, 9)
    expect(valueOf(b, high.taskId)).toBeCloseTo(2, 9)
    expect(valueOf(b, normal.taskId)).toBeCloseTo(1, 9) // proporção 2:1 preservada
  })

  it('5. hábitos parciais e opcional proporcional', () => {
    const partial = habit(1 / 3)
    const b = score([habit(1), habit(1), partial, habit(0), habit(0.5, false)], [])
    expect(b.base).toBe(5.8)
    expect(b.score).toBe(5.9) // 5,8 + 0,125 do opcional; sem +0,3
    expect(b.adjustments.map((a) => a.id)).toEqual(['optional-habits'])
    expect(b.adjustments[0]!.value).toBeCloseTo(0.125, 9)
    const item = b.items!.find((i) => i.id === partial.habitId)!
    expect(item.value).toBeCloseTo(2.5, 9)
    expect(item.earned).toBeCloseTo(2.5 / 3, 9)
  })

  it('6. tarefa atrasada: peso integral da prioridade, sem penalidade', () => {
    const b = score(many(4, () => habit(1)), [task('low', false, 'overdue')])
    expect(b.score).toBe(9.2) // 8,9 + 0,3
    expect(b.adjustments.some((a) => a.kind === 'penalty')).toBe(false)
    expect(b.items!.find((i) => i.role === 'overdue')!.units).toBe(0.5)
  })

  it('7. dia sem plano: só opcional e tarefa adiantada → sem nota', () => {
    const b = score([habit(1, false)], [task('normal', true, 'bonus')])
    expect(b.score).toBeNull()
    expect(b.base).toBeNull()
    expect(b.version).toBe('v2')
  })
})

/* ------------------------------ propriedades ------------------------------ */

/** Gerador determinístico (mulberry32) para planos aleatórios reproduzíveis. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']
function randomPlan(r: () => number): ScoringInput {
  const progress = () => (r() < 0.35 ? 0 : r() < 0.5 ? 1 : Math.round(r() * 10) / 10)
  const habits = many(Math.floor(r() * 9), () => habit(progress(), r() < 0.75, { done: Math.floor(r() * 4), expectedByToday: Math.floor(r() * 4) }))
  const tasks = many(Math.floor(r() * 13), () => task(PRIORITIES[Math.floor(r() * 3)]!, r() < 0.4, r() < 0.15 ? 'bonus' : r() < 0.3 ? 'overdue' : 'due'))
  return { date: D, habits, tasks }
}
const CASES = (() => {
  const r = rng(20261102)
  return many(500, () => randomPlan(r))
})()
const planned = (i: ScoringInput) => i.habits.some((h) => h.requirement === 'required') || i.tasks.some((t) => t.role !== 'bonus')

describe('nota v2 — propriedades', () => {
  it('1 e 9. a soma exata dos valores do plano é 10 e a nota fica entre 0 e 10', () => {
    for (const input of CASES.filter(planned)) {
      const b = scoringV2.compute(input)
      expect(sumValues(b, ['required', 'due', 'overdue'])).toBeCloseTo(10, 9)
      expect(b.score!).toBeGreaterThanOrEqual(0)
      expect(b.score!).toBeLessThanOrEqual(10)
    }
  })

  it('2. concluir ou avançar um item nunca reduz a nota', () => {
    for (const input of CASES) {
      const before = scoringV2.compute(input).score
      input.habits.forEach((h, i) => {
        if (h.sessionProgress >= 1) return
        const habits = input.habits.map((x, j) => (j === i ? { ...x, sessionProgress: 1, doneToday: true } : x))
        const after = scoringV2.compute({ ...input, habits }).score
        if (before !== null) expect(after!).toBeGreaterThanOrEqual(before)
      })
      input.tasks.forEach((t, i) => {
        if (t.doneOnDay || t.role === 'bonus') return
        const tasks = input.tasks.map((x, j) => (j === i ? { ...x, doneOnDay: true } : x))
        const after = scoringV2.compute({ ...input, tasks }).score
        if (before !== null) expect(after!).toBeGreaterThanOrEqual(before)
      })
    }
  })

  it('3. adicionar um item pendente ao plano nunca aumenta a nota', () => {
    for (const input of CASES.filter(planned)) {
      const before = scoringV2.compute(input).score!
      for (const p of PRIORITIES) expect(scoringV2.compute({ ...input, tasks: [...input.tasks, task(p, false)] }).score!).toBeLessThanOrEqual(before)
      expect(scoringV2.compute({ ...input, habits: [...input.habits, habit(0)] }).score!).toBeLessThanOrEqual(before)
    }
  })

  it('4. o histórico da semana não muda a nota do dia', () => {
    for (const input of CASES) {
      const habits = input.habits.map((h) => ({ ...h, week: { done: h.week.done + 3, expectedByToday: h.week.expectedByToday + 1 } }))
      expect(scoringV2.compute({ ...input, habits })).toEqual(scoringV2.compute(input))
    }
  })

  it('5. teto: tarefas até o número de hábitos não mudam nada; acima disso somam 50%; sem hábitos, 100%', () => {
    for (const input of CASES.filter(planned)) {
      const b = scoringV2.compute(input)
      const H = input.habits.filter((h) => h.requirement === 'required').length
      const T = sumValues(b, ['due', 'overdue']) // valores das tarefas
      const units = (b.items ?? []).filter((i) => i.role === 'due' || i.role === 'overdue').reduce((s, i) => s + i.units, 0)
      if (units === 0) continue
      if (H === 0) expect(T).toBeCloseTo(10, 9)
      else if (units <= H) {
        expect(b.taskCap!.k).toBe(1)
        expect(T).toBeCloseTo((10 * units) / (H + units), 9)
      } else expect(T).toBeCloseTo(5, 9)
      // Proporção entre prioridades preservada: valor ÷ unidades é o mesmo para todas as tarefas.
      const perUnit = (b.items ?? []).filter((i) => i.units > 0 && i.kind === 'task').map((i) => i.value / i.units)
      for (const v of perUnit) expect(v).toBeCloseTo(perUnit[0]!, 9)
    }
    expect(taskCapFactor(4, 4)).toBe(1)
    expect(taskCapFactor(0, 9)).toBe(1)
    expect(taskCapFactor(2, 8)).toBeCloseTo(0.25, 9)
  })

  it('5b. sem salto quando o teto liga: com T = H a nota é a mesma com ou sem teto', () => {
    const habits = many(3, (i) => habit(i === 0 ? 1 : 0))
    const atLimit = score(habits, many(3, (i) => task('normal', i === 0)))
    expect(atLimit.taskCap!.active).toBe(false)
    expect(atLimit.base).toBe(Math.round((10 * 2) / 6 * 10) / 10)
  })

  it('6. sem hábito exigido nem tarefa do dia → null, mesmo com opcionais e adiantadas', () => {
    for (const input of CASES.filter((i) => !planned(i))) expect(scoringV2.compute(input).score).toBeNull()
  })

  it('7. o +0,3 exige pelo menos um hábito exigido, todos com sessão concluída (parcial não basta)', () => {
    expect(score([], [task('normal', true)]).adjustments).toEqual([])
    expect(score([habit(1), habit(0.9)], []).adjustments.some((a) => a.id === 'all-habits')).toBe(false)
    expect(score([habit(1), habit(1)], []).adjustments.some((a) => a.id === 'all-habits')).toBe(true)
  })

  it('8. opcionais rendem bônus proporcional, no total até 0,75', () => {
    const one = score([habit(1)], [task('normal', false)])
    const withOpt = score([habit(1), habit(0.4, false)], [task('normal', false)])
    expect(withOpt.adjustments.find((a) => a.id === 'optional-habits')!.value).toBeCloseTo(0.1, 9)
    expect(withOpt.base).toBe(one.base)
    const capped = score([habit(1), ...many(5, () => habit(1, false))], [])
    expect(capped.adjustments.find((a) => a.id === 'optional-habits')!.value).toBe(0.75)
  })

  it('arredondamento: meio para cima na base e no resultado', () => {
    // 5 de 8 itens = 6,25 → 6,3
    expect(score(many(8, (i) => habit(i < 5 ? 1 : 0)), []).base).toBe(6.3)
  })
})
