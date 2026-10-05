import type { ISODate, Timestamp, Weekday } from '../date'
import type { HabitColorKey, HabitIconKey } from './appearance'
import type { AttributeId } from './attributes'
import type { ID } from './ids'

export const HABIT_CATEGORY_IDS = ['health', 'study', 'creative', 'mind', 'career', 'routine', 'finance', 'social'] as const
export type HabitCategoryId = (typeof HABIT_CATEGORY_IDS)[number]

export interface HabitCategory {
  id: HabitCategoryId
  label: string
  attribute: AttributeId
}

export const HABIT_CATEGORIES: Record<HabitCategoryId, HabitCategory> = {
  health: { id: 'health', label: 'Saúde & corpo', attribute: 'vitality' },
  study: { id: 'study', label: 'Estudo', attribute: 'intellect' },
  creative: { id: 'creative', label: 'Arte & música', attribute: 'creativity' },
  mind: { id: 'mind', label: 'Mente', attribute: 'spirit' },
  career: { id: 'career', label: 'Carreira', attribute: 'intellect' },
  routine: { id: 'routine', label: 'Rotina & casa', attribute: 'discipline' },
  finance: { id: 'finance', label: 'Finanças', attribute: 'discipline' },
  social: { id: 'social', label: 'Social', attribute: 'spirit' },
}

export const TARGET_UNITS = ['minutes', 'times', 'pages', 'glasses', 'km'] as const
export type TargetUnit = (typeof TARGET_UNITS)[number]

export const TARGET_UNIT_LABEL: Record<TargetUnit, { short: string; singular: string; plural: string }> = {
  minutes: { short: 'min', singular: 'minuto', plural: 'minutos' },
  times: { short: 'x', singular: 'vez', plural: 'vezes' },
  pages: { short: 'pág', singular: 'página', plural: 'páginas' },
  glasses: { short: 'copos', singular: 'copo', plural: 'copos' },
  km: { short: 'km', singular: 'km', plural: 'km' },
}

/** Meta por sessão (ex.: 30 minutos de guitarra). */
export interface HabitTarget {
  amount: number
  unit: TargetUnit
}

export interface HabitSchedule {
  /** Quantas sessões por semana (1–7). */
  weeklyGoal: number
  /**
   * Dias fixos da semana. `null` = frequência flexível (o sistema distribui o
   * ritmo esperado ao longo da semana).
   */
  days: Weekday[] | null
}

/**
 * Versão da meta de um hábito. Vale a partir da semana `from` (segunda-feira)
 * até a próxima versão. Mantém o histórico honesto quando a meta evolui.
 */
export interface HabitGoalVersion {
  from: ISODate
  schedule: HabitSchedule
  target: HabitTarget | null
}

export interface Habit {
  id: ID
  name: string
  description?: string
  category: HabitCategoryId
  schedule: HabitSchedule
  target: HabitTarget | null
  icon: HabitIconKey
  color: HabitColorKey
  archived: boolean
  /**
   * Só dá para confirmar depois (ex.: "dormir até 23h"). O hábito aparece na
   * revisão da manhã seguinte para ser marcado pelo dia anterior.
   */
  confirmNextDay?: boolean
  /**
   * Histórico de metas (ordenado por `from`). A última versão é sempre igual a
   * `schedule`/`target`. Ausente = a meta nunca mudou.
   */
  goalHistory?: HabitGoalVersion[]
  /** Sugestões de progressão adiadas até esta data. */
  progressionSnoozedUntil?: ISODate
  /** Primeiro dia em que o hábito passa a contar. */
  startDate: ISODate
  createdAt: Timestamp
  order: number
}

/** Registro de um hábito em um dia (no máximo um por hábito/dia). */
export interface HabitLog {
  id: ID
  habitId: ID
  date: ISODate
  /** Quantidade acumulada no dia (minutos, páginas… ou 1 para hábitos sem meta). */
  value: number
  /** Snapshot: a sessão atingiu a meta no momento do registro. */
  completed: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type HabitInput = Pick<Habit, 'name' | 'description' | 'category' | 'schedule' | 'target' | 'icon' | 'color' | 'confirmNextDay'>
