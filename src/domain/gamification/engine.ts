import type { AttributeId } from '../models/attributes'
import type { GameEvent, LedgerDraft, LedgerEntry, ResourceId } from '../models/gamification'
import { DEFAULT_RULES, type AnyRewardRule } from './rules'

/**
 * Aplica as regras a um evento e devolve os lançamentos resultantes.
 * Função pura: quem persiste é a camada de estado.
 */
export function evaluateEvent(event: GameEvent, rules: readonly AnyRewardRule[] = DEFAULT_RULES): LedgerDraft[] {
  const drafts: LedgerDraft[] = []
  for (const r of rules) {
    if (r.event !== event.type) continue
    // O mapeamento evento→regra é garantido pelo filtro acima.
    const typed = r as unknown as {
      compute: (e: GameEvent) => number | null
      attribute?: (e: GameEvent) => AttributeId | undefined
      sourceKey: (e: GameEvent) => string
    }
    const amount = typed.compute(event)
    if (amount === null || amount === 0) continue
    const attribute = typed.attribute?.(event)
    drafts.push({
      resource: r.resource,
      amount,
      reason: r.label,
      ruleId: r.id,
      sourceKey: typed.sourceKey(event),
      date: event.date,
      ...(attribute ? { attribute } : {}),
    })
  }
  return drafts
}

export function sumResource(entries: readonly Pick<LedgerEntry, 'resource' | 'amount'>[], resource: ResourceId): number {
  let total = 0
  for (const e of entries) if (e.resource === resource) total += e.amount
  return total
}

export function balances(entries: readonly LedgerEntry[]): Partial<Record<ResourceId, number>> {
  const out: Partial<Record<ResourceId, number>> = {}
  for (const e of entries) out[e.resource] = (out[e.resource] ?? 0) + e.amount
  return out
}

export function attributeXp(entries: readonly LedgerEntry[]): Partial<Record<AttributeId, number>> {
  const out: Partial<Record<AttributeId, number>> = {}
  for (const e of entries) {
    if (e.resource !== 'xp' || !e.attribute) continue
    out[e.attribute] = (out[e.attribute] ?? 0) + e.amount
  }
  return out
}

/** Nível de atributo: curva mais curta que a do personagem. */
export function attributeLevel(xp: number): { level: number; progress: number; current: number; required: number } {
  let level = 1
  const req = (l: number) => 25 * l * (l - 1)
  while (req(level + 1) <= xp) level++
  const base = req(level)
  const required = req(level + 1) - base
  return { level, progress: (xp - base) / required, current: xp - base, required }
}
