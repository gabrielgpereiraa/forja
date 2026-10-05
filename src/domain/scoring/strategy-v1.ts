import { clamp, formatNumber } from '../../lib/utils'
import type { ScoreAdjustment, ScoreBreakdown, ScoreComponent, ScoringInput, ScoringStrategy } from './types'
import { taskWeight } from '../rules/task-agenda'

/** Pesos e limites da fórmula v1 — centralizados para fácil ajuste. */
export const V1 = {
  weights: { habits: 5, tasks: 4, rhythm: 1 },
  bonus: {
    allHabits: 0.3,
    extraHabit: 0.25,
    extraHabitMax: 0.75,
    earlyTask: 0.15,
    earlyTaskMax: 0.45,
  },
  penalty: {
    overdueTask: 0.15,
    overdueTaskMax: 0.45,
  },
} as const

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function compute(input: ScoringInput): ScoreBreakdown {
  const components: ScoreComponent[] = []
  const adjustments: ScoreAdjustment[] = []
  const highlights: string[] = []

  /* 1. Hábitos previstos para o dia (crédito parcial por progresso). */
  const required = input.habits.filter((h) => h.requirement === 'required')
  const requiredDone = required.filter((h) => h.doneToday).length
  const habitRatio = required.length ? required.reduce((s, h) => s + h.sessionProgress, 0) / required.length : 0
  components.push({
    id: 'habits',
    label: 'Hábitos do dia',
    weight: V1.weights.habits,
    ratio: habitRatio,
    detail: required.length ? `${requiredDone} de ${required.length}` : 'Nenhum hábito previsto',
    skipped: required.length === 0,
  })
  if (required.length)
    highlights.push(`${requiredDone} de ${required.length} ${required.length === 1 ? 'hábito concluído' : 'hábitos concluídos'}`)

  /* 2. Tarefas do dia + atrasadas, ponderadas pela prioridade. */
  const counted = input.tasks.filter((t) => t.role !== 'bonus')
  const totalW = counted.reduce((s, t) => s + taskWeight(t.task), 0)
  const doneW = counted.filter((t) => t.doneOnDay).reduce((s, t) => s + taskWeight(t.task), 0)
  const tasksDone = counted.filter((t) => t.doneOnDay).length
  components.push({
    id: 'tasks',
    label: 'Tarefas',
    weight: V1.weights.tasks,
    ratio: totalW ? doneW / totalW : 0,
    detail: counted.length ? `${tasksDone} de ${counted.length}` : 'Nenhuma tarefa prevista',
    skipped: counted.length === 0,
  })
  if (counted.length)
    highlights.push(`${tasksDone} de ${counted.length} ${counted.length === 1 ? 'tarefa concluída' : 'tarefas concluídas'}`)

  /* 3. Ritmo semanal: quão perto do ritmo esperado cada hábito está. */
  const paced = input.habits.filter((h) => h.week.expectedByToday > 0)
  const rhythm = paced.length
    ? paced.reduce((s, h) => s + Math.min(1, h.week.done / h.week.expectedByToday), 0) / paced.length
    : 0
  components.push({
    id: 'rhythm',
    label: 'Ritmo semanal',
    weight: V1.weights.rhythm,
    ratio: rhythm,
    detail: paced.length ? `${Math.round(rhythm * 100)}% do ritmo das metas` : 'Sem metas em andamento',
    skipped: paced.length === 0,
  })

  /* Ajustes */
  if (required.length > 0 && requiredDone === required.length) {
    adjustments.push({ id: 'all-habits', label: 'Todos os hábitos do dia', value: V1.bonus.allHabits, kind: 'bonus' })
  }
  const extras = input.habits.filter((h) => h.requirement !== 'required' && h.doneToday).length
  if (extras > 0) {
    adjustments.push({
      id: 'extra-habits',
      label: extras === 1 ? '1 hábito extra' : `${extras} hábitos extras`,
      value: Math.min(V1.bonus.extraHabitMax, extras * V1.bonus.extraHabit),
      kind: 'bonus',
    })
  }
  const early = input.tasks.filter((t) => t.role === 'bonus').length
  if (early > 0) {
    adjustments.push({
      id: 'early-tasks',
      label: early === 1 ? '1 tarefa adiantada' : `${early} tarefas adiantadas`,
      value: Math.min(V1.bonus.earlyTaskMax, early * V1.bonus.earlyTask),
      kind: 'bonus',
    })
  }
  const overduePending = input.tasks.filter((t) => t.role === 'overdue' && !t.doneOnDay).length
  if (overduePending > 0) {
    adjustments.push({
      id: 'overdue',
      label: overduePending === 1 ? '1 tarefa atrasada' : `${overduePending} tarefas atrasadas`,
      value: -Math.min(V1.penalty.overdueTaskMax, overduePending * V1.penalty.overdueTask),
      kind: 'penalty',
    })
  }

  const active = components.filter((c) => !c.skipped)
  // Ritmo sozinho não justifica uma nota: exige hábitos ou tarefas no dia.
  const hasPlan = active.some((c) => c.id !== 'rhythm') || extras > 0 || early > 0
  if (!hasPlan) {
    return { version: 'v1', score: null, base: null, components, adjustments: [], completion: 0, highlights: [] }
  }

  const weightSum = active.reduce((s, c) => s + c.weight, 0)
  const completion = weightSum ? active.reduce((s, c) => s + c.weight * c.ratio, 0) / weightSum : 1
  const base = round1(completion * 10)
  const adj = adjustments.reduce((s, a) => s + a.value, 0)
  const score = round1(clamp(base + adj, 0, 10))
  highlights.push(`${formatNumber(completion * 100)}% da meta diária atingida`)

  return { version: 'v1', score, base, components, adjustments, completion, highlights }
}

export const scoringV1: ScoringStrategy = {
  version: 'v1',
  label: 'Fórmula v1 — hábitos, tarefas e ritmo',
  compute,
}
