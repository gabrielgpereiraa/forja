/**
 * Nota v2 — unidades por item, com teto de 50% para tarefas.
 *
 * base = round1(10 × (h + k·t) ÷ (H + k·T))
 *   H = hábitos exigidos; h = soma dos progressos deles (0–1 cada)
 *   T = unidades de tarefas do dia e atrasadas (baixa 0,5 · normal 1 · alta 2); t = unidades concluídas
 *   k = H ÷ T quando há hábitos exigidos e T > H (tarefas limitadas a 50% da base); 1 nos demais casos
 *
 * Bônus: +0,3 com todos os exigidos concluídos (exige ao menos um); opcionais
 * 0,25 × progresso, até 0,75; tarefas adiantadas +0,15, até 0,45. Sem
 * penalidade por atraso. Sem hábito exigido nem tarefa → nota `null`.
 * O ritmo da semana não entra na nota (indicador próprio).
 */
import { clamp, formatNumber } from '../../lib/utils'
import { taskWeight } from '../rules/task-agenda'
import type { ScoreAdjustment, ScoreBreakdown, ScoreComponent, ScoreItem, ScoringInput, ScoringStrategy } from './types'

/** Valores da v2 — centralizados para fácil ajuste. */
export const V2 = {
  /** Participação máxima das tarefas na base quando há hábitos exigidos. */
  taskShareMax: 0.5,
  bonus: {
    allHabits: 0.3,
    optionalHabit: 0.25,
    optionalHabitMax: 0.75,
    earlyTask: 0.15,
    earlyTaskMax: 0.45,
  },
} as const

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Fator do teto: com hábitos exigidos e mais unidades de tarefa do que hábitos, as tarefas somam no máximo 50%. */
export function taskCapFactor(H: number, T: number): number {
  if (H <= 0 || T <= H) return 1
  // 50% = H ÷ (H + kT) ⇒ kT = H ⇒ k = H ÷ T. Generalizado para outra participação máxima s: kT = H·s/(1−s).
  return (H * V2.taskShareMax) / (1 - V2.taskShareMax) / T
}

function compute(input: ScoringInput): ScoreBreakdown {
  const required = input.habits.filter((h) => h.requirement === 'required')
  const optional = input.habits.filter((h) => h.requirement !== 'required')
  const counted = input.tasks.filter((t) => t.role !== 'bonus')
  const early = input.tasks.filter((t) => t.role === 'bonus')

  const H = required.length
  const h = required.reduce((s, x) => s + clamp(x.sessionProgress, 0, 1), 0)
  const T = counted.reduce((s, x) => s + taskWeight(x.task), 0)
  const t = counted.filter((x) => x.doneOnDay).reduce((s, x) => s + taskWeight(x.task), 0)
  const k = taskCapFactor(H, T)
  const denom = H + k * T
  const habitValue = denom > 0 ? 10 / denom : 0
  const taskUnitValue = denom > 0 ? (10 * k) / denom : 0

  const items: ScoreItem[] = [
    ...required.map((x): ScoreItem => {
      const p = clamp(x.sessionProgress, 0, 1)
      return { kind: 'habit', id: x.habitId ?? null, role: 'required', units: 1, value: habitValue, earned: habitValue * p, progress: p }
    }),
    ...optional.map((x): ScoreItem => {
      const p = clamp(x.sessionProgress, 0, 1)
      return { kind: 'habit', id: x.habitId ?? null, role: 'optional', units: 0, value: V2.bonus.optionalHabit, earned: V2.bonus.optionalHabit * p, progress: p }
    }),
    ...counted.map((x): ScoreItem => {
      const u = taskWeight(x.task)
      const p = x.doneOnDay ? 1 : 0
      return { kind: 'task', id: x.taskId ?? null, role: x.role === 'overdue' ? 'overdue' : 'due', units: u, value: taskUnitValue * u, earned: taskUnitValue * u * p, progress: p }
    }),
    ...early.map((x): ScoreItem => ({ kind: 'task', id: x.taskId ?? null, role: 'early', units: 0, value: V2.bonus.earlyTask, earned: V2.bonus.earlyTask, progress: 1 })),
  ]

  const requiredDone = required.filter((x) => x.doneToday).length
  const tasksDone = counted.filter((x) => x.doneOnDay).length
  const capActive = k < 1
  const components: ScoreComponent[] = [
    {
      id: 'habits',
      label: 'Hábitos do dia',
      weight: H,
      ratio: H ? h / H : 0,
      detail: H ? `${requiredDone} de ${H}` : 'Nenhum hábito previsto',
      skipped: H === 0,
    },
    {
      id: 'tasks',
      label: 'Tarefas',
      weight: k * T,
      ratio: T ? t / T : 0,
      detail: counted.length ? `${tasksDone} de ${counted.length}${capActive ? ' · limitadas a 50%' : ''}` : 'Nenhuma tarefa prevista',
      skipped: T === 0,
    },
  ]
  const taskCap = { k, active: capActive }

  // Sem plano (nenhum exigido nem tarefa do dia/atrasada): dia neutro, mesmo com extras.
  if (H === 0 && T === 0) {
    return { version: 'v2', score: null, base: null, components, adjustments: [], completion: 0, highlights: [], items, taskCap }
  }

  const adjustments: ScoreAdjustment[] = []
  if (H > 0 && requiredDone === H) {
    adjustments.push({ id: 'all-habits', label: 'Todos os hábitos do dia', value: V2.bonus.allHabits, kind: 'bonus' })
  }
  const optionalWithProgress = optional.filter((x) => x.sessionProgress > 0)
  const optionalBonus = Math.min(
    V2.bonus.optionalHabitMax,
    optional.reduce((s, x) => s + V2.bonus.optionalHabit * clamp(x.sessionProgress, 0, 1), 0),
  )
  if (optionalBonus > 0) {
    const n = optionalWithProgress.length
    adjustments.push({ id: 'optional-habits', label: n === 1 ? '1 hábito opcional' : `${n} hábitos opcionais`, value: optionalBonus, kind: 'bonus' })
  }
  if (early.length > 0) {
    adjustments.push({
      id: 'early-tasks',
      label: early.length === 1 ? '1 tarefa adiantada' : `${early.length} tarefas adiantadas`,
      value: Math.min(V2.bonus.earlyTaskMax, early.length * V2.bonus.earlyTask),
      kind: 'bonus',
    })
  }

  const completion = (h + k * t) / denom
  const base = round1(completion * 10)
  const adj = adjustments.reduce((s, a) => s + a.value, 0)
  const score = round1(clamp(base + adj, 0, 10))
  const planned = H + counted.length
  const highlights = [
    `${requiredDone + tasksDone} de ${planned} ${planned === 1 ? 'item do plano concluído' : 'itens do plano concluídos'}`,
    `${formatNumber(completion * 100)}% do plano`,
  ]
  if (capActive) highlights.push('Tarefas limitadas a 50% da nota base')

  return { version: 'v2', score, base, components, adjustments, completion, highlights, items, taskCap }
}

export const scoringV2: ScoringStrategy = {
  version: 'v2',
  label: 'Fórmula v2 — itens do plano, tarefas até 50%',
  compute,
}
