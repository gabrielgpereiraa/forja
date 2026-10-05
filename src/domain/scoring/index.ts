import { scoringV1 } from './strategy-v1'
import type { ScoringInput, ScoringStrategy, ScoreBreakdown } from './types'

/** Registro de estratégias. Novas versões entram aqui; o histórico preserva a sua. */
export const SCORING_STRATEGIES: Record<string, ScoringStrategy> = {
  [scoringV1.version]: scoringV1,
}

export const CURRENT_SCORING: ScoringStrategy = scoringV1

export function computeDayScore(input: ScoringInput, strategy: ScoringStrategy = CURRENT_SCORING): ScoreBreakdown {
  return strategy.compute(input)
}

export * from './types'
