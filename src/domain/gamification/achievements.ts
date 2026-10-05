import type { AchievementDefinition, PlayerStats } from '../models/gamification'

const count =
  (key: keyof PlayerStats, target: number) =>
  (s: PlayerStats): { current: number; target: number } => ({ current: Math.min(s[key], target), target })

/** Conquistas v1. Novas conquistas = novas entradas aqui. */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  { id: 'first-step', title: 'Primeiro passo', description: 'Conclua sua primeira sessão de hábito', tier: 'bronze', progress: count('habitSessions', 1) },
  { id: 'first-day', title: 'Ritual', description: 'Encerre seu primeiro dia', tier: 'bronze', progress: count('daysClosed', 1) },
  { id: 'task-10', title: 'Resolvedor', description: 'Conclua 10 tarefas', tier: 'bronze', progress: count('tasksCompleted', 10) },
  { id: 'streak-3', title: 'Embalo', description: '3 dias positivos seguidos', tier: 'bronze', progress: count('bestStreak', 3) },
  { id: 'weekly-goal', title: 'Compromisso cumprido', description: 'Bata a meta semanal de um hábito', tier: 'bronze', progress: count('weeklyGoalsMet', 1) },
  { id: 'excellent', title: 'Dia de ouro', description: 'Feche um dia com nota 9 ou mais', tier: 'silver', progress: count('excellentDays', 1) },
  { id: 'streak-7', title: 'Semana sólida', description: '7 dias positivos seguidos', tier: 'silver', progress: count('bestStreak', 7) },
  { id: 'sessions-50', title: 'Constância', description: 'Conclua 50 sessões de hábitos', tier: 'silver', progress: count('habitSessions', 50) },
  { id: 'focus-600', title: 'Dez horas', description: 'Acumule 600 minutos de foco', tier: 'silver', progress: count('totalFocusMinutes', 600) },
  { id: 'level-10', title: 'Veterano', description: 'Alcance o nível 10', tier: 'gold', progress: count('level', 10) },
  { id: 'streak-30', title: 'Inabalável', description: '30 dias positivos seguidos', tier: 'gold', progress: count('bestStreak', 30) },
  { id: 'sessions-250', title: 'Lenda em formação', description: 'Conclua 250 sessões de hábitos', tier: 'gold', progress: count('habitSessions', 250) },
]

export function isAchievementUnlocked(def: AchievementDefinition, stats: PlayerStats): boolean {
  const p = def.progress(stats)
  return p.current >= p.target
}

export function findNewlyUnlocked(stats: PlayerStats, alreadyUnlocked: ReadonlySet<string>): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((a) => !alreadyUnlocked.has(a.id) && isAchievementUnlocked(a, stats))
}
