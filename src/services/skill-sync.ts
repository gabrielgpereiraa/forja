/**
 * Sincronização hábitos → habilidades e efeitos colaterais do sistema de
 * habilidades (lançamentos de recompensa). Funções puras sobre `AppData`.
 */
import { nowTimestamp, type ISODate } from '@/domain/date'
import { evaluateEvent } from '@/domain/gamification/engine'
import type { GameEvent, LedgerEntry } from '@/domain/models/gamification'
import type { Habit, HabitLog } from '@/domain/models/habit'
import { createId } from '@/domain/models/ids'
import type { HabitSkillContribution, Skill, SkillPractice } from '@/domain/models/skill'
import { habitForDate } from '@/domain/rules/habit-goal-history'
import { diffSnapshots, replaySkill, type SkillDelta } from '@/domain/skills/engine'
import type { AppData } from './app-data'

export interface SkillFeedback {
  skill: Pick<Skill, 'id' | 'name' | 'icon' | 'color'>
  delta: SkillDelta
  /** Peso do vínculo que gerou a variação (para escolher o destaque). */
  weight: number
}

/** Converte o registro de um hábito em práticas para cada habilidade vinculada. */
export function practicesFromLog(habit: Habit, log: HabitLog, links: readonly HabitSkillContribution[]): SkillPractice[] {
  if (log.value <= 0) return []
  const h = habitForDate(habit, log.date)
  const unit = h.target?.unit ?? null
  const isTime = unit === 'minutes'
  // Sem duração: esforço relativo à meta da sessão (20/20 páginas = 1; só concluir = 1).
  const intensity = isTime ? 1 : h.target ? log.value / h.target.amount : log.completed ? 1 : 0.5
  return links
    .filter((l) => l.habitId === habit.id)
    .map((l) => ({
      id: createId('sp'),
      skillId: l.skillId,
      date: log.date,
      duration: isTime ? log.value : null,
      value: isTime ? null : h.target ? log.value : null,
      unit,
      intensity,
      weight: l.weight,
      // Regras v2: esforço proporcional à meta vigente na data e critério de prática válida.
      rulesVersion: 2 as const,
      targetMinutes: isTime ? h.target!.amount : null,
      sourceHabitId: habit.id,
      sourceLogId: log.id,
      createdAt: nowTimestamp(),
    }))
}

/** Substitui as práticas geradas por um registro (atualizado ou removido). */
export function replaceLogPractices(
  practices: readonly SkillPractice[],
  habit: Habit,
  logId: string,
  log: HabitLog | null,
  links: readonly HabitSkillContribution[],
): SkillPractice[] {
  const kept = practices.filter((p) => p.sourceLogId !== logId)
  return log ? [...kept, ...practicesFromLog(habit, log, links)] : kept
}

/** Importa registros existentes de um hábito para uma habilidade recém-vinculada. */
export function backfillLink(data: AppData, link: HabitSkillContribution): SkillPractice[] {
  const habit = data.habits.find((h) => h.id === link.habitId)
  if (!habit) return data.skillPractices
  const existing = new Set(data.skillPractices.filter((p) => p.skillId === link.skillId && p.sourceLogId).map((p) => p.sourceLogId))
  const added = data.logs
    .filter((l) => l.habitId === habit.id && !existing.has(l.id))
    .flatMap((l) => practicesFromLog(habit, l, [link]))
  return [...data.skillPractices, ...added]
}

/**
 * Mantém os lançamentos de "habilidade subiu de nível" coerentes com o nível
 * atual (idempotente: adiciona os que faltam, remove os que não valem mais).
 */
export function syncSkillLevelRewards(ledger: readonly LedgerEntry[], skill: Skill, level: number, date: ISODate): LedgerEntry[] {
  const prefix = `skillLevel:${skill.id}:`
  const kept = ledger.filter((e) => !e.sourceKey.startsWith(prefix) || Number(e.sourceKey.slice(prefix.length)) <= level)
  const have = new Set(kept.filter((e) => e.sourceKey.startsWith(prefix)).map((e) => e.sourceKey))
  const added: LedgerEntry[] = []
  for (let l = 2; l <= level; l++) {
    if (have.has(`${prefix}${l}`)) continue
    const event: GameEvent = { type: 'skill.level_up', skill, level: l, date }
    for (const d of evaluateEvent(event)) added.push({ ...d, id: createId('lg'), createdAt: nowTimestamp() })
  }
  return [...kept, ...added]
}

/**
 * Aplica novas práticas e devolve variações por habilidade (para feedback) e
 * o ledger com recompensas de nível sincronizadas.
 */
export function commitSkillChanges(
  data: AppData,
  nextPractices: SkillPractice[],
  affectedSkillIds: readonly string[],
  date: ISODate,
  weights: ReadonlyMap<string, number> = new Map(),
): { data: AppData; feedback: SkillFeedback[] } {
  let ledger = data.ledger
  const feedback: SkillFeedback[] = []
  for (const id of new Set(affectedSkillIds)) {
    const skill = data.skills.find((s) => s.id === id)
    if (!skill || skill.archived) continue
    const before = replaySkill(skill, data.skillPractices, date)
    const after = replaySkill(skill, nextPractices, date)
    ledger = syncSkillLevelRewards(ledger, skill, after.level, date)
    const delta = diffSnapshots(before, after)
    if (Math.abs(delta.xpGained) > 0.01 || Math.abs(delta.conditionAfter - delta.conditionBefore) > 0.01) {
      feedback.push({ skill: { id: skill.id, name: skill.name, icon: skill.icon, color: skill.color }, delta, weight: weights.get(id) ?? 1 })
    }
  }
  feedback.sort((a, b) => b.weight - a.weight || b.delta.xpGained - a.delta.xpGained)
  return { data: { ...data, skillPractices: nextPractices, ledger }, feedback }
}
