import { scoringV1 } from './strategy-v1'
import type { ScoringInput, ScoringStrategy, ScoreBreakdown } from './types'

/** Registro de estratégias. Novas versões entram aqui; o histórico preserva a sua. */
export const SCORING_STRATEGIES: Record<string, ScoringStrategy> = {
  [scoringV1.version]: scoringV1,
}

export const CURRENT_SCORING: ScoringStrategy = scoringV1

/** Versão assumida por registros sem `breakdown.version` (anteriores ao versionamento explícito). */
export const LEGACY_SCORING_VERSION = 'v1'

/**
 * Estratégia que calculou um dia encerrado. Recalcular esse dia (confirmação
 * tardia) usa sempre a mesma versão — nunca a ativa. `null` = versão
 * desconhecida (ex.: dado gravado por uma versão mais nova do app): o dia não
 * deve ser recalculado.
 */
export function strategyFor(version: string | null | undefined): ScoringStrategy | null {
  const v = version || LEGACY_SCORING_VERSION
  return (Object.hasOwn(SCORING_STRATEGIES, v) && SCORING_STRATEGIES[v]) || null
}

export function computeDayScore(input: ScoringInput, strategy: ScoringStrategy = CURRENT_SCORING): ScoreBreakdown {
  return strategy.compute(input)
}

export * from './types'
