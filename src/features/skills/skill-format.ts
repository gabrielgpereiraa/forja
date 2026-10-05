/**
 * Textos e indicadores derivados das regras de habilidade. Linguagem de
 * incentivo: "você pode recuperar", nunca "você foi punido".
 */
import type { Skill, SkillStatus } from '@/domain/models/skill'
import { SKILL_CONFIG } from '@/domain/skills/config'
import type { SkillSnapshot } from '@/domain/skills/engine'
import { clamp, formatNumber } from '@/lib/utils'

export const STATUS_META: Record<SkillStatus, { label: string; symbol: string; tone: 'primary' | 'muted' | 'rust' }> = {
  evolving: { label: 'Evoluindo', symbol: '↑', tone: 'primary' },
  maintaining: { label: 'Mantendo', symbol: '→', tone: 'muted' },
  rusting: { label: 'Enferrujando', symbol: '⚠', tone: 'rust' },
  new: { label: 'Nova', symbol: '✦', tone: 'muted' },
}

/** "2" ou "1,5" */
export function formatSessions(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : formatNumber(r, 1)
}

export function sessionsLabel(s: SkillSnapshot): string {
  return `${formatSessions(s.sessionsInWindow)} / ${s.maintenancePerWeek} sessões · 7 dias`
}

export function lastPracticeLabel(s: SkillSnapshot): string {
  if (s.daysSinceLast === null) return 'Ainda sem prática'
  if (s.daysSinceLast === 0) return 'Praticou hoje'
  if (s.daysSinceLast === 1) return 'Praticou ontem'
  return `Última prática há ${s.daysSinceLast} dias`
}

/**
 * Intensidade visual da ferrugem (0–1). Só aparece quando a habilidade está
 * enferrujando ou já perdeu condição relevante.
 */
export function rustLevel(s: SkillSnapshot): number {
  if (s.status === 'new') return 0
  const span = SKILL_CONFIG.MAX_CONDITION - s.minimumCondition
  const lost = clamp((SKILL_CONFIG.MAX_CONDITION - s.condition) / span, 0, 1)
  const base = s.status === 'rusting' ? 0.35 + 0.65 * lost : Math.max(0, lost - 0.35) * 0.6
  return Math.round(clamp(base, 0, 1) * 100) / 100
}

export function sessionsNeeded(s: SkillSnapshot): number {
  return Math.max(0, Math.ceil(s.maintenancePerWeek - s.sessionsInWindow - 1e-9))
}

/** Explicação do estado — responde "por que está assim?" e "o que eu faço?". */
export function explainStatus(skill: Pick<Skill, 'name'>, s: SkillSnapshot): { title: string; body: string } {
  const window = `${formatSessions(s.sessionsInWindow)} de ${s.maintenancePerWeek} sessões nos últimos 7 dias`
  switch (s.status) {
    case 'new':
      return { title: 'Pronta para começar', body: 'Registre a primeira prática para começar a forjar esta habilidade.' }
    case 'evolving':
      return {
        title: 'Evoluindo',
        body: `${window} — acima da manutenção. Cada sessão afia a condição${s.condition >= SKILL_CONFIG.MASTERY_CONDITION_THRESHOLD ? ' e consolida a maestria' : ''}.`,
      }
    case 'maintaining':
      if (s.daysUntilRust !== null) {
        const days = s.daysUntilRust
        return {
          title: 'Mantendo, por pouco',
          body: `${window}. Uma sessão ${days <= 1 ? 'hoje' : `nos próximos ${days} dias`} mantém ${skill.name} sem enferrujar.`,
        }
      }
      return { title: 'Mantendo', body: `${window}. No ritmo de manutenção — sem ferrugem.` }
    case 'rusting': {
      const need = sessionsNeeded(s)
      return {
        title: `${skill.name} está enferrujando`,
        body: `${s.daysSinceLast} dias sem praticar e ${window}. A condição cai devagar${
          s.mastery >= 20 ? ` — sua maestria (${Math.round(s.mastery)}) segura boa parte da perda` : ''
        }. Nível e maestria continuam seus. ${need === 1 ? 'Uma sessão' : `${need} sessões`} esta semana ${need === 1 ? 'já recupera' : 'recuperam'} a condição.`,
      }
    }
  }
}

export function formatPercent(n: number): string {
  return `${Math.round(n)}%`
}
