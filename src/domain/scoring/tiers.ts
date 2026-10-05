export type ScoreTierId = 'legendary' | 'great' | 'good' | 'fair' | 'low' | 'empty'

export interface ScoreTier {
  id: ScoreTierId
  label: string
  min: number
}

export const SCORE_TIERS: readonly ScoreTier[] = [
  { id: 'legendary', label: 'Lendário', min: 9 },
  { id: 'great', label: 'Ótimo', min: 7.5 },
  { id: 'good', label: 'Bom', min: 6 },
  { id: 'fair', label: 'Regular', min: 4 },
  { id: 'low', label: 'Fraco', min: 0 },
]

const EMPTY: ScoreTier = { id: 'empty', label: 'Sem plano', min: -1 }

export function getScoreTier(score: number | null | undefined): ScoreTier {
  if (score === null || score === undefined) return EMPTY
  return SCORE_TIERS.find((t) => score >= t.min) ?? SCORE_TIERS[SCORE_TIERS.length - 1]!
}
