/**
 * Habilidades: competências específicas (Guitarra, Programação, Corrida…) que
 * evoluem com a prática e enferrujam quando deixadas de lado.
 *
 * Três conceitos distintos:
 * - Nível (domínio)     → progressão histórica, vem da experiência. Nunca cai.
 * - Condição (0–100)    → quão afiada está agora. Sobe com prática, cai com inatividade, tem piso.
 * - Maestria (0–100)    → consolidação. Cresce devagar com prática consistente,
 *                          reduz a ferrugem e acelera a recuperação. Nunca cai.
 *
 * Só a definição e as práticas são persistidas. Nível, experiência, condição,
 * maestria e estado são uma *projeção determinística* das práticas até uma
 * data (ver `domain/skills/engine.ts`) — por isso funcionam mesmo que o app
 * fique semanas fechado, e o histórico diário pode ser reconstruído a qualquer
 * momento para gráficos.
 */
import type { ISODate, Timestamp } from '../date'
import type { HabitColorKey, HabitIconKey } from './appearance'
import type { HabitCategoryId } from './habit'
import type { ID } from './ids'

export interface Skill {
  id: ID
  name: string
  description?: string
  /** Categoria (reaproveita as de hábito) — liga a habilidade a um atributo do personagem. */
  category: HabitCategoryId
  icon: HabitIconKey
  color: HabitColorKey
  /** Sessões por semana necessárias para não enferrujar. */
  maintenancePerWeek: number
  /** Duração de referência de "1 sessão" em minutos (normaliza práticas com tempo). */
  sessionMinutes: number
  /** Piso de condição (opcional: usa o padrão da configuração). */
  minimumCondition?: number
  archived: boolean
  /** Início da contagem (pode ser anterior à criação quando o histórico é importado). */
  startDate: ISODate
  createdAt: Timestamp
  updatedAt: Timestamp
  order: number
}

export type SkillInput = Pick<Skill, 'name' | 'description' | 'category' | 'icon' | 'color' | 'maintenancePerWeek' | 'sessionMinutes'>

/** Uma prática registrada. Guarda a quantidade real (base de recompensas futuras). */
export interface SkillPractice {
  id: ID
  skillId: ID
  /** Dia de produtividade em que aconteceu. */
  date: ISODate
  /** Minutos praticados, quando houver. */
  duration: number | null
  /** Quantidade em outra unidade (páginas, km…), quando houver. */
  value: number | null
  unit: string | null
  /**
   * Esforço relativo quando não há duração (ex.: 20/20 páginas = 1).
   * Com duração, o esforço é calculado a partir de `Skill.sessionMinutes`.
   */
  intensity: number
  /** Peso da contribuição do hábito para esta habilidade (1 = 100%). */
  weight: number
  /** Origem: hábito/registro que gerou a prática (null = prática avulsa). */
  sourceHabitId: ID | null
  sourceLogId: ID | null
  createdAt: Timestamp
}

/** Quanto um hábito contribui para uma habilidade (1 = 100%, 0.2 = 20%). */
export interface HabitSkillContribution {
  habitId: ID
  skillId: ID
  weight: number
}

export type SkillStatus =
  /** Praticando acima da manutenção. */
  | 'evolving'
  /** Dentro da manutenção (ou ainda no período de tolerância). */
  | 'maintaining'
  /** Abaixo da manutenção e fora da tolerância: condição caindo. */
  | 'rusting'
  /** Nunca praticada. */
  | 'new'
