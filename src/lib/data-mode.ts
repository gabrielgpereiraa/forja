/**
 * Decide se o app usa a nuvem (Supabase) ou só o navegador. Puro, para testes.
 *
 * `VITE_DATA_MODE=local` força o modo local mesmo com as variáveis do
 * Supabase presentes — usado na homologação (ambiente Preview da Vercel),
 * onde as variáveis do Supabase não podem ser removidas: nada é lido nem
 * gravado nos dados reais, não há login nem sincronização.
 */
export interface DataModeEnv {
  url?: string | null
  key?: string | null
  mode?: string | null
}

export function cloudEnabledFor(env: DataModeEnv): boolean {
  if (env.mode?.trim().toLowerCase() === 'local') return false
  return Boolean(env.url && env.key)
}
