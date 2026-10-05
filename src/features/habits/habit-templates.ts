import type { HabitInput } from '@/domain/models/habit'

/** Sugestões para criação rápida (estado vazio e formulário). */
export const HABIT_TEMPLATES: HabitInput[] = [
  { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 5, days: null }, target: { amount: 20, unit: 'pages' } },
  { name: 'Exercícios', category: 'health', icon: 'dumbbell', color: 'lime', schedule: { weeklyGoal: 4, days: null }, target: null },
  { name: 'Treinar guitarra', category: 'creative', icon: 'guitar', color: 'violet', schedule: { weeklyGoal: 4, days: null }, target: { amount: 30, unit: 'minutes' } },
  { name: 'Meditar', category: 'mind', icon: 'leaf', color: 'emerald', schedule: { weeklyGoal: 7, days: null }, target: { amount: 10, unit: 'minutes' } },
  { name: 'Estudar programação', category: 'career', icon: 'code', color: 'indigo', schedule: { weeklyGoal: 5, days: null }, target: { amount: 45, unit: 'minutes' } },
  { name: 'Estudar inglês', category: 'study', icon: 'languages', color: 'sky', schedule: { weeklyGoal: 3, days: null }, target: { amount: 20, unit: 'minutes' } },
  { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 5, days: null }, target: null, confirmNextDay: true },
  { name: 'Beber água', category: 'health', icon: 'droplets', color: 'sky', schedule: { weeklyGoal: 7, days: null }, target: { amount: 8, unit: 'glasses' } },
]
