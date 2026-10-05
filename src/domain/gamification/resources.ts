import type { ResourceDefinition, ResourceId } from '../models/gamification'

export const RESOURCES: Record<'xp' | 'focus', ResourceDefinition> = {
  xp: {
    id: 'xp',
    label: 'Experiência',
    shortLabel: 'XP',
    description: 'Mede sua evolução. Acumula níveis.',
  },
  focus: {
    id: 'focus',
    label: 'Foco',
    shortLabel: 'foco',
    description: '1 ponto por minuto dedicado a hábitos com meta de tempo. Futura moeda de recompensas.',
  },
}

export function getResource(id: ResourceId): ResourceDefinition | undefined {
  return (RESOURCES as Record<string, ResourceDefinition>)[id]
}
