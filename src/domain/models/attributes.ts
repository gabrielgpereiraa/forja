/**
 * Atributos do "personagem". Cada categoria de hábito alimenta um atributo;
 * tarefas alimentam Disciplina. É a base para classes, builds e
 * especializações futuras.
 */
export const ATTRIBUTE_IDS = ['vitality', 'intellect', 'creativity', 'spirit', 'discipline'] as const
export type AttributeId = (typeof ATTRIBUTE_IDS)[number]

export interface AttributeDefinition {
  id: AttributeId
  label: string
  description: string
}

export const ATTRIBUTES: Record<AttributeId, AttributeDefinition> = {
  vitality: { id: 'vitality', label: 'Vitalidade', description: 'Corpo, energia e saúde' },
  intellect: { id: 'intellect', label: 'Intelecto', description: 'Estudo, leitura e carreira' },
  creativity: { id: 'creativity', label: 'Criatividade', description: 'Música, arte e criação' },
  spirit: { id: 'spirit', label: 'Espírito', description: 'Mente, equilíbrio e relações' },
  discipline: { id: 'discipline', label: 'Disciplina', description: 'Tarefas, rotina e finanças' },
}
