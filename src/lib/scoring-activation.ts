/**
 * Ativação da nota v2 a partir do build (variáveis de ambiente da Vercel).
 *
 * - `VITE_SCORING_V2_FROM`  — primeiro dia do app com a v2 (AAAA-MM-DD). Ausente = v2 desligada.
 * - `VITE_SCORING_V2_UNTIL` — opcional: primeiro dia de volta à v1 (reversão a partir de um dia futuro).
 * - `VITE_VERCEL_ENV`       — preenchida no build a partir de `VERCEL_ENV` (vite.config.ts).
 *
 * Trava: conectado ao Supabase, a v2 só liga em build de produção. Importado
 * por `main.tsx` antes do app, para valer desde o primeiro cálculo.
 */
import { configureScoringActivation, resolveScoringActivation } from '@/domain/scoring'
import { cloudEnabled } from './supabase'

export const scoringActivation = resolveScoringActivation({
  from: import.meta.env.VITE_SCORING_V2_FROM as string | undefined,
  until: import.meta.env.VITE_SCORING_V2_UNTIL as string | undefined,
  vercelEnv: import.meta.env.VITE_VERCEL_ENV as string | undefined,
  cloud: cloudEnabled,
})

configureScoringActivation(scoringActivation)

if (scoringActivation.blocked) {
  console.warn(`[Forja] Nota v2 desligada: ${scoringActivation.blocked}.`)
}
