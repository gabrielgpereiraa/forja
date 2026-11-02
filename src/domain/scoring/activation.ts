/**
 * Qual estratégia de nota vale para cada dia do app.
 *
 * A v2 é ligada por uma data de dia do app (`v2From`, inclusiva) e, para
 * reverter sem trocar a regra de um dia em andamento, pode ser encerrada por
 * `v2Until` (exclusiva). A comparação é feita sobre a data de produtividade,
 * que já respeita o início do dia configurado (ex.: 04:00) — um dia nunca muda
 * de estratégia no meio do seu ciclo, desde que as datas sejam futuras quando
 * publicadas. Dias encerrados não passam por aqui: recalculam pela versão
 * gravada (`strategyFor`).
 */
import type { ISODate } from '../date'
import { scoringV1 } from './strategy-v1'
import { scoringV2 } from './strategy-v2'
import type { ScoringStrategy } from './types'

export interface ScoringActivation {
  /** Primeiro dia do app com a v2 (inclusivo). `null` = v2 desligada. */
  v2From: ISODate | null
  /** Primeiro dia de volta à v1 (exclusivo), para reverter a partir de um dia futuro. */
  v2Until: ISODate | null
}

export const SCORING_V2_OFF: ScoringActivation = { v2From: null, v2Until: null }

let current: ScoringActivation = SCORING_V2_OFF

/** Define a ativação do app (feito uma vez na inicialização, a partir do build). */
export function configureScoringActivation(activation: ScoringActivation): void {
  current = activation
}

export function getScoringActivation(): ScoringActivation {
  return current
}

export function isV2Day(date: ISODate, activation: ScoringActivation = current): boolean {
  return activation.v2From !== null && date >= activation.v2From && (activation.v2Until === null || date < activation.v2Until)
}

/** Estratégia para calcular um dia ainda não encerrado (nota ao vivo, revisão da manhã, encerramento). */
export function strategyForDay(date: ISODate, activation: ScoringActivation = current): ScoringStrategy {
  return isV2Day(date, activation) ? scoringV2 : scoringV1
}

const ISO = /^\d{4}-\d{2}-\d{2}$/

function validDate(raw: string | undefined | null): ISODate | null {
  const v = raw?.trim()
  if (!v || !ISO.test(v)) return null
  const d = new Date(`${v}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? null : (v as ISODate)
}

export interface ActivationEnv {
  /** `VITE_SCORING_V2_FROM` (AAAA-MM-DD). */
  from?: string | null
  /** `VITE_SCORING_V2_UNTIL` (AAAA-MM-DD). */
  until?: string | null
  /** Ambiente da Vercel no build (`production`, `preview`, `development`) ou vazio fora dela. */
  vercelEnv?: string | null
  /** O app está conectado ao Supabase (dados reais)? */
  cloud: boolean
}

export interface ResolvedActivation extends ScoringActivation {
  /** Motivo de a v2 ter ficado desligada apesar de uma data configurada. */
  blocked: string | null
}

/**
 * Lê a configuração do build. Trava: com dados na nuvem, a v2 só liga num build
 * de produção da Vercel — uma prévia (ou ambiente local) conectada ao Supabase
 * ignora a data e não grava registros v2 em dados reais. No modo local (sem
 * Supabase) a data vale normalmente, para homologação.
 */
export function resolveScoringActivation(env: ActivationEnv): ResolvedActivation {
  const v2From = validDate(env.from)
  const v2Until = validDate(env.until)
  if (!v2From) return { v2From: null, v2Until: null, blocked: env.from?.trim() ? 'data inválida' : null }
  if (env.cloud && env.vercelEnv !== 'production') {
    return { v2From: null, v2Until: null, blocked: 'v2 só liga com Supabase num build de produção' }
  }
  return { v2From, v2Until, blocked: null }
}
