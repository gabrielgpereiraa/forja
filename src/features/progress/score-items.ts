/**
 * Rótulos dos valores por item da nota v2 (lista de Hoje, Tarefas e detalhe).
 * Os valores vêm do detalhamento calculado pela estratégia — a tela não refaz
 * a conta. Exibidos com uma casa; a nota usa os valores exatos.
 */
import type { ScoreBreakdown, ScoreItem } from '@/domain/scoring'
import { formatNumber } from '@/lib/utils'

export type ScoreItemKind = ScoreItem['kind']

export const scoreItemKey = (kind: ScoreItemKind, id: string) => `${kind}:${id}`

/** Itens do detalhamento por chave (`habit:<id>` / `task:<id>`); `null` em detalhamentos sem itens (v1). */
export function scoreItemMap(breakdown: ScoreBreakdown): Map<string, ScoreItem> | null {
  if (!breakdown.items) return null
  const map = new Map<string, ScoreItem>()
  for (const item of breakdown.items) if (item.id) map.set(scoreItemKey(item.kind, item.id), item)
  return map
}

const n1 = (v: number) => formatNumber(v, 1)
const n2 = (v: number) => formatNumber(v, 2)

export interface ScoreItemLabel {
  text: string
  title: string
  done: boolean
}

export function scoreItemLabel(item: ScoreItem): ScoreItemLabel {
  if (item.role === 'optional') {
    return item.progress > 0
      ? { text: `bônus +${n2(item.earned)}`, title: `Opcional: rendeu +${n2(item.earned)} de bônus (até +${n2(item.value)})`, done: item.progress >= 1 }
      : { text: 'bônus', title: `Opcional: rende até +${n2(item.value)} de bônus na nota de hoje`, done: false }
  }
  if (item.role === 'early') return { text: `bônus +${n2(item.value)}`, title: 'Tarefa adiantada: bônus na nota de hoje', done: true }
  if (item.progress >= 1) return { text: `+${n1(item.value)}`, title: `Concluído: rendeu ${n1(item.value)} na nota de hoje`, done: true }
  if (item.progress > 0) {
    return { text: `${n1(item.earned)} de ${n1(item.value)}`, title: `Parcial: rendeu ${n1(item.earned)} de ${n1(item.value)} na nota de hoje`, done: false }
  }
  return { text: n1(item.value), title: `Vale ${n1(item.value)} na nota de hoje`, done: false }
}
