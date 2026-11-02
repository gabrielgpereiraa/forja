/**
 * Contratos do sistema de nota diária.
 *
 * A nota é sempre *explicável*: é a média ponderada de componentes (cada um
 * com peso, aproveitamento e descrição) mais ajustes (bônus/penalidades)
 * nomeados. Estratégias são versionadas para que a fórmula evolua sem
 * reescrever o histórico — cada `DailyRecord` guarda a versão usada.
 */
import type { ISODate } from '../date'
import type { ID } from '../models/ids'
import type { TaskPriority } from '../models/task'
import type { HabitRequirement } from '../rules/habit-schedule'
import type { TaskDayRole } from '../rules/task-agenda'

export interface ScoreComponent {
  id: string
  label: string
  /** Peso relativo na média. */
  weight: number
  /** Aproveitamento de 0 a 1. */
  ratio: number
  /** Texto curto: "4 de 5 hábitos". */
  detail: string
  /** Componente ignorado (sem itens) — não entra na média. */
  skipped: boolean
}

export interface ScoreAdjustment {
  id: string
  label: string
  /** Pontos somados (ou subtraídos) à nota, na escala 0–10. */
  value: number
  kind: 'bonus' | 'penalty'
}

/**
 * Um item do plano no detalhamento (v2): quanto vale na nota base e quanto já
 * rendeu. Opcionais e tarefas adiantadas aparecem com `role` de bônus e valor
 * igual ao bônus máximo do item (antes do limite do dia).
 */
export interface ScoreItem {
  kind: 'habit' | 'task'
  /** Id do hábito/tarefa; `null` só em entradas antigas sem id. */
  id: ID | null
  role: 'required' | 'optional' | 'due' | 'overdue' | 'early'
  /** Unidades no plano (hábito exigido 1; tarefa = peso da prioridade); 0 nos bônus. */
  units: number
  /** Pontos na nota base quando concluído (exato, sem arredondar). */
  value: number
  /** Pontos já rendidos (exato). */
  earned: number
  /** Progresso do item (0–1). */
  progress: number
}

export interface ScoreBreakdown {
  version: string
  /** Nota final (0–10, uma casa) ou `null` quando não havia nada planejado. */
  score: number | null
  /** Nota antes dos ajustes. */
  base: number | null
  components: ScoreComponent[]
  adjustments: ScoreAdjustment[]
  /** Aproveitamento ponderado (0–1) — "% da meta diária". */
  completion: number
  /** Frases prontas para explicar a nota. */
  highlights: string[]
  /** v2: itens do plano e bônus, com valor e ganho de cada um. */
  items?: ScoreItem[]
  /** v2: fator do teto das tarefas (`k`); `active` quando as tarefas foram limitadas a 50%. */
  taskCap?: { k: number; active: boolean }
}

/**
 * O que uma estratégia pode ler de um hábito no dia. `HabitDayState` atende
 * por estrutura; o retrato do encerramento (`DayScoringSnapshot`) guarda
 * exatamente estes campos — uma estratégia que leia algo além disso não pode
 * recalcular dias encerrados.
 */
export interface ScoringHabit {
  /** Id do hábito (presente no retrato e na nota ao vivo; usado pelo detalhamento v2). */
  habitId?: ID
  requirement: HabitRequirement
  doneToday: boolean
  /** Progresso da sessão (0–1). */
  sessionProgress: number
  week: { done: number; expectedByToday: number }
}

/** O que uma estratégia pode ler de uma tarefa no dia (`TaskDayItem` atende por estrutura). */
export interface ScoringTask {
  /** Id da tarefa (presente no retrato e na nota ao vivo; usado pelo detalhamento v2). */
  taskId?: ID
  role: TaskDayRole
  doneOnDay: boolean
  task: { priority: TaskPriority }
}

export interface ScoringInput {
  date: ISODate
  habits: readonly ScoringHabit[]
  tasks: readonly ScoringTask[]
}

export interface ScoringStrategy {
  version: string
  label: string
  compute: (input: ScoringInput) => ScoreBreakdown
}
