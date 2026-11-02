/**
 * Comandos de habilidades (camada de aplicação). Mesma convenção dos demais:
 * funções puras `(data, ...) → { data, feedback }`.
 */
import { nowTimestamp, type ISODate } from '@/domain/date'
import { evaluateEvent } from '@/domain/gamification/engine'
import type { GameEvent } from '@/domain/models/gamification'
import { TARGET_UNIT_LABEL } from '@/domain/models/habit'
import { createId } from '@/domain/models/ids'
import type { HabitSkillContribution, Skill, SkillInput, SkillPractice } from '@/domain/models/skill'
import { habitForDate } from '@/domain/rules/habit-goal-history'
import { clamp } from '@/lib/utils'
import type { AppData } from './app-data'
import * as cmd from './commands'
import { backfillLink, commitSkillChanges } from './skill-sync'

export const CONTRIBUTION_WEIGHTS = [1, 0.5, 0.2, 0.1] as const

function sanitize(input: SkillInput): SkillInput {
  const description = input.description?.trim()
  return {
    ...input,
    name: input.name.trim(),
    description: description || undefined,
    maintenancePerWeek: clamp(Math.round(input.maintenancePerWeek), 1, 7),
    sessionMinutes: clamp(Math.round(input.sessionMinutes), 5, 240),
  }
}

export interface LinkInput {
  habitId: string
  weight: number
}

/**
 * Cria uma habilidade. Vínculos com hábitos importam o histórico existente
 * (as sessões já feitas contam) — a habilidade nasce com o nível que você já tem.
 */
export function createSkill(
  data: AppData,
  input: SkillInput,
  links: readonly LinkInput[],
  today: ISODate,
): { data: AppData; skill: Skill; imported: number } {
  const now = nowTimestamp()
  const skill: Skill = {
    ...sanitize(input),
    id: createId('sk'),
    archived: false,
    startDate: today,
    createdAt: now,
    updatedAt: now,
    order: data.skills.reduce((m, s) => Math.max(m, s.order), 0) + 1,
  }
  let next: AppData = { ...data, skills: [...data.skills, skill] }
  const before = next.skillPractices.length
  next = setSkillLinks(next, skill.id, links, today)
  return { data: next, skill, imported: next.skillPractices.length - before }
}

export function updateSkill(data: AppData, id: string, input: SkillInput): AppData {
  return {
    ...data,
    skills: data.skills.map((s) => (s.id === id ? { ...s, ...sanitize(input), updatedAt: nowTimestamp() } : s)),
  }
}

export function setSkillArchived(data: AppData, id: string, archived: boolean): AppData {
  return { ...data, skills: data.skills.map((s) => (s.id === id ? { ...s, archived, updatedAt: nowTimestamp() } : s)) }
}

export function deleteSkill(data: AppData, id: string): AppData {
  const practiceKeys = new Set(data.skillPractices.filter((p) => p.skillId === id).map((p) => `skillPractice:${p.id}`))
  return {
    ...data,
    skills: data.skills.filter((s) => s.id !== id),
    skillPractices: data.skillPractices.filter((p) => p.skillId !== id),
    skillLinks: data.skillLinks.filter((l) => l.skillId !== id),
    ledger: data.ledger.filter((e) => !e.sourceKey.startsWith(`skillLevel:${id}:`) && !practiceKeys.has(e.sourceKey)),
  }
}

/**
 * Define os hábitos que treinam a habilidade. Vínculos novos importam o
 * histórico do hábito; vínculos removidos param de contribuir, mas as práticas
 * já registradas continuam (o que foi forjado não se perde).
 */
export function setSkillLinks(data: AppData, skillId: string, links: readonly LinkInput[], today: ISODate): AppData {
  const clean = new Map<string, number>()
  for (const l of links) if (l.weight > 0 && data.habits.some((h) => h.id === l.habitId)) clean.set(l.habitId, clamp(l.weight, 0.05, 1))
  const nextLinks: HabitSkillContribution[] = [
    ...data.skillLinks.filter((l) => l.skillId !== skillId),
    ...[...clean].map(([habitId, weight]) => ({ habitId, skillId, weight })),
  ]
  const previous = new Set(data.skillLinks.filter((l) => l.skillId === skillId).map((l) => l.habitId))
  let next: AppData = { ...data, skillLinks: nextLinks }
  let practices = next.skillPractices
  for (const [habitId, weight] of clean) {
    if (previous.has(habitId)) continue
    practices = backfillLink({ ...next, skillPractices: practices }, { habitId, skillId, weight })
  }
  // Histórico importado pode começar antes da criação da habilidade.
  next = commitSkillChanges(next, practices, [skillId], today).data
  return next
}

/**
 * Hábito "principal" de uma habilidade: vínculo de 100% com hábito ativo.
 * Registrar prática pela habilidade registra nesse hábito (evita lançar duas vezes).
 */
export function primaryHabitOf(data: AppData, skillId: string) {
  const link = data.skillLinks.find((l) => l.skillId === skillId && l.weight >= 1 && data.habits.some((h) => h.id === l.habitId && !h.archived))
  return link ? data.habits.find((h) => h.id === link.habitId) ?? null : null
}

export interface PracticeInput {
  /** Minutos praticados (null = "fiz", sem duração). */
  duration: number | null
}

/**
 * Registrar prática a partir da habilidade. Se houver hábito principal com meta
 * de tempo (ou sem meta), registra nele — assim a prática também conta para o
 * dia. Caso contrário, cria uma prática avulsa.
 */
export function logSkillPractice(data: AppData, skillId: string, input: PracticeInput, date: ISODate): cmd.CommandResult & { via: 'habit' | 'skill' } {
  const skill = data.skills.find((s) => s.id === skillId)
  if (!skill) return { data, feedback: emptyFeedback(), via: 'skill' }

  const habit = primaryHabitOf(data, skillId)
  if (habit && !data.records[date]) {
    const h = habitForDate(habit, date)
    const current = data.logs.find((l) => l.habitId === habit.id && l.date === date)?.value ?? 0
    if (h.target?.unit === 'minutes') {
      const value = input.duration ? current + input.duration : Math.max(current, h.target.amount)
      return { ...cmd.setHabitValue(data, habit.id, date, value, date), via: 'habit' }
    }
    if (!h.target) {
      // Hábito sem meta: concluir o dia, e a duração vira prática avulsa adicional.
      const done = current > 0 ? { data, feedback: emptyFeedback() } : cmd.setHabitValue(data, habit.id, date, 1, date)
      if (!input.duration) return { ...done, via: 'habit' }
      const extra = addStandalonePractice(done.data, skill, input, date)
      return { data: extra.data, feedback: { ...done.feedback, skills: extra.feedback.skills }, via: 'habit' }
    }
  }
  return { ...addStandalonePractice(data, skill, input, date), via: 'skill' }
}

function emptyFeedback(): cmd.Feedback {
  return { xp: 0, focus: 0, events: [], achievements: [], levelUp: null, skills: [] }
}

function addStandalonePractice(data: AppData, skill: Skill, input: PracticeInput, date: ISODate): cmd.CommandResult {
  const practice: SkillPractice = {
    id: createId('sp'),
    skillId: skill.id,
    date,
    duration: input.duration,
    value: null,
    unit: input.duration ? 'minutes' : null,
    intensity: 1,
    weight: 1,
    sourceHabitId: null,
    sourceLogId: null,
    createdAt: nowTimestamp(),
  }
  const res = commitSkillChanges(data, [...data.skillPractices, practice], [skill.id], date)
  const event: GameEvent = { type: 'skill.practiced', skill, practice, date }
  const entries = evaluateEvent(event).map((d) => ({ ...d, id: createId('lg'), createdAt: nowTimestamp() }))
  const next = { ...res.data, ledger: [...res.data.ledger, ...entries] }
  const focus = entries.filter((e) => e.resource === 'focus').reduce((s, e) => s + e.amount, 0)
  const xp = next.ledger.reduce((s, e) => s + (e.resource === 'xp' ? e.amount : 0), 0) - data.ledger.reduce((s, e) => s + (e.resource === 'xp' ? e.amount : 0), 0)
  return { data: next, feedback: { ...emptyFeedback(), xp, focus, events: [event.type], skills: res.feedback } }
}

/** Remove uma prática avulsa (as vindas de hábitos são editadas pelo hábito). */
export function removeSkillPractice(data: AppData, practiceId: string, today: ISODate): AppData {
  const practice = data.skillPractices.find((p) => p.id === practiceId)
  if (!practice || practice.sourceLogId) return data
  const skill = data.skills.find((s) => s.id === practice.skillId)
  const remaining = data.skillPractices.filter((p) => p.id !== practiceId)
  const ledger = data.ledger.filter((e) => e.sourceKey !== `skillPractice:${practiceId}`)
  // commitSkillChanges também ressincroniza as recompensas de nível.
  return skill ? commitSkillChanges({ ...data, ledger }, remaining, [practice.skillId], today).data : data
}

/** Rótulo curto de uma prática para listas ("30 min", "20 páginas", "Sessão"). */
export function practiceLabel(p: SkillPractice): string {
  if (p.duration) return `${Math.round(p.duration)} min`
  if (p.value !== null && p.unit && p.unit in TARGET_UNIT_LABEL) {
    const u = TARGET_UNIT_LABEL[p.unit as keyof typeof TARGET_UNIT_LABEL]
    return `${p.value} ${p.value === 1 ? u.singular : u.plural}`
  }
  return 'Sessão'
}
