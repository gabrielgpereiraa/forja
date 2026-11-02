import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { cloudEnabledFor } from './data-mode'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Cliente do Supabase. Sem as variáveis de ambiente — ou com
 * `VITE_DATA_MODE=local` (homologação) — o app roda em modo local (dados só no
 * navegador), como na v1.
 */
export const supabase: SupabaseClient | null =
  url && key && cloudEnabledFor({ url, key, mode: import.meta.env.VITE_DATA_MODE as string | undefined })
    ? createClient(url, key, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const cloudEnabled = supabase !== null
