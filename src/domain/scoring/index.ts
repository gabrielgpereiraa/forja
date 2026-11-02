import { scoringV1 } from './strategy-v1'
import { scoringV2 } from './strategy-v2'
import type { ScoringInput, ScoringStrategy, ScoreBreakdown } from './types'

/**
 * Registro de estratégias. Novas versões entram aqui; o histórico preserva a
 * sua. Uma estratégia nunca sai do registro: dias encerrados com ela precisam
 * continuar legíveis e recalculáveis (inclusive depois de uma reversão).
 */
export const SCORING_STRATEGIES: Record<string, ScoringStrategy> = {
  [scoringV1.version]: scoringV1,
  [scoringV2.version]: scoringV2,
}

/**
 * Estratégia padrão quando a v2 não está ligada para o dia. Para um dia
 * específico, use `strategyForDay(data)`; para um dia encerrado, `strategyFor(versão)`.
 */
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
export { configureScoringActivation, getScoringActivation, isV2Day, resolveScoringActivation, SCORING_V2_OFF, strategyForDay } from './activation'
export type { ActivationEnv, ResolvedActivation, ScoringActivation } from './activation'
export { scoringV1 } from './strategy-v1'
export { scoringV2, taskCapFactor, V2 } from './strategy-v2'
