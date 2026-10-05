import type { Habit } from '@/domain/models/habit'
import type { HabitSkillContribution, SkillInput } from '@/domain/models/skill'
import type { LinkInput } from '@/services/skill-commands'

const VERBS = /^(treinar|estudar|praticar|fazer|aprender|tocar|ler)\s+/i

function skillNameFor(habit: Habit): string {
  const stripped = habit.name.replace(VERBS, '').trim()
  const base = stripped.length >= 3 ? stripped : habit.name
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/** Sugestões de habilidade para hábitos que ainda não treinam nenhuma. */
export function suggestSkillsFromHabits(
  habits: readonly Habit[],
  links: readonly HabitSkillContribution[],
): { habit: Habit; input: SkillInput; links: LinkInput[] }[] {
  const linked = new Set(links.map((l) => l.habitId))
  return habits
    .filter((h) => !h.archived && !linked.has(h.id) && !h.confirmNextDay)
    .map((habit) => ({
      habit,
      input: {
        name: skillNameFor(habit),
        description: '',
        category: habit.category,
        icon: habit.icon,
        color: habit.color,
        // Manter custa menos que evoluir: ~metade da meta semanal do hábito.
        maintenancePerWeek: Math.max(1, Math.ceil(habit.schedule.weeklyGoal / 2)),
        sessionMinutes: habit.target?.unit === 'minutes' ? habit.target.amount : 30,
      },
      links: [{ habitId: habit.id, weight: 1 }],
    }))
}
