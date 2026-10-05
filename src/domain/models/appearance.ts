/**
 * Identidade visual de hábitos: chaves estáveis (persistidas) que a camada de
 * UI traduz em ícones/cores. O domínio não conhece React nem CSS.
 */
export const HABIT_ICON_KEYS = [
  'guitar',
  'dumbbell',
  'book',
  'code',
  'brain',
  'droplets',
  'languages',
  'music',
  'bike',
  'footprints',
  'apple',
  'moon',
  'heart',
  'pen',
  'palette',
  'leaf',
  'wallet',
  'graduation',
  'headphones',
  'sparkles',
  'target',
  'bed',
] as const
export type HabitIconKey = (typeof HABIT_ICON_KEYS)[number]

export const HABIT_COLOR_KEYS = ['lime', 'emerald', 'sky', 'indigo', 'violet', 'rose', 'orange', 'amber'] as const
export type HabitColorKey = (typeof HABIT_COLOR_KEYS)[number]
