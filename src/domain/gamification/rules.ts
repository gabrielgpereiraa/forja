import { HABIT_CATEGORIES } from '../models/habit'
import type { GameEventType, RewardRule } from '../models/gamification'
import { TASK_PRIORITY_META } from '../models/task'

/**
 * Regras padrão de recompensa (v1). Para adicionar novas mecânicas basta
 * acrescentar regras aqui — ou, futuramente, carregá-las da configuração do
 * usuário ("regras personalizadas").
 */
export type AnyRewardRule = { [K in GameEventType]: RewardRule<K> }[GameEventType]

const rule = <T extends GameEventType>(r: RewardRule<T>): AnyRewardRule => r as unknown as AnyRewardRule

export const DEFAULT_RULES: readonly AnyRewardRule[] = [
  rule({
    id: 'habit.session.xp',
    event: 'habit.session_completed',
    resource: 'xp',
    label: 'Hábito concluído',
    description: '+20 XP por sessão concluída',
    compute: () => 20,
    attribute: (e) => HABIT_CATEGORIES[e.habit.category].attribute,
    sourceKey: (e) => `habitLog:${e.log.id}`,
  }),
  rule({
    id: 'habit.session.focus',
    event: 'habit.session_completed',
    resource: 'focus',
    label: 'Tempo dedicado',
    description: '+1 de foco por minuto em hábitos com meta de tempo',
    compute: (e) => (e.habit.target?.unit === 'minutes' ? Math.round(e.log.value) : null),
    sourceKey: (e) => `habitLog:${e.log.id}`,
  }),
  rule({
    id: 'habit.weekly_goal.xp',
    event: 'habit.weekly_goal_reached',
    resource: 'xp',
    label: 'Meta semanal atingida',
    description: '+50 XP ao bater a meta semanal de um hábito',
    compute: () => 50,
    attribute: (e) => HABIT_CATEGORIES[e.habit.category].attribute,
    sourceKey: (e) => `weeklyGoal:${e.habit.id}:${e.weekStart}`,
  }),
  rule({
    id: 'task.completed.xp',
    event: 'task.completed',
    resource: 'xp',
    label: 'Tarefa concluída',
    description: '+5 / +10 / +20 XP conforme a prioridade',
    compute: (e) => Math.round(10 * TASK_PRIORITY_META[e.task.priority].weight),
    attribute: () => 'discipline',
    sourceKey: (e) => `task:${e.task.id}`,
  }),
  rule({
    id: 'skill.practice.focus',
    event: 'skill.practiced',
    resource: 'focus',
    label: 'Prática avulsa',
    description: '+1 de foco por minuto em práticas registradas direto na habilidade',
    // Práticas vindas de hábitos já rendem foco pelo hábito — não contar duas vezes.
    compute: (e) => (e.practice.sourceHabitId === null && e.practice.duration ? Math.round(e.practice.duration) : null),
    sourceKey: (e) => `skillPractice:${e.practice.id}`,
  }),
  rule({
    id: 'skill.level_up.xp',
    event: 'skill.level_up',
    resource: 'xp',
    label: 'Habilidade subiu de nível',
    description: '+25 XP a cada novo nível de uma habilidade',
    compute: () => 25,
    attribute: (e) => HABIT_CATEGORIES[e.skill.category].attribute,
    sourceKey: (e) => `skillLevel:${e.skill.id}:${e.level}`,
  }),
  rule({
    id: 'day.closed.score',
    event: 'day.closed',
    resource: 'xp',
    label: 'Dia encerrado',
    description: 'XP = nota do dia × 10',
    compute: (e) => (e.record.score === null ? null : Math.round(e.record.score * 10)),
    sourceKey: (e) => `day:${e.record.date}`,
  }),
  rule({
    id: 'day.closed.ritual',
    event: 'day.closed',
    resource: 'xp',
    label: 'Ritual de encerramento',
    description: '+10 XP ao encerrar o dia você mesmo',
    compute: (e) => (e.record.closedBy === 'user' && e.record.score !== null ? 10 : null),
    attribute: () => 'discipline',
    sourceKey: (e) => `day:${e.record.date}`,
  }),
  rule({
    id: 'day.closed.perfect_habits',
    event: 'day.closed',
    resource: 'xp',
    label: 'Todos os hábitos do dia',
    description: '+30 XP ao concluir todos os hábitos previstos',
    compute: (e) =>
      e.record.totalHabits > 0 && e.record.completedHabits >= e.record.totalHabits ? 30 : null,
    sourceKey: (e) => `day:${e.record.date}`,
  }),
  rule({
    id: 'day.closed.streak_milestone',
    event: 'day.closed',
    resource: 'xp',
    label: 'Marco de sequência',
    description: '+100 XP a cada 7 dias seguidos',
    compute: (e) => (e.streak > 0 && e.streak % 7 === 0 ? 100 : null),
    sourceKey: (e) => `day:${e.record.date}`,
  }),
]
