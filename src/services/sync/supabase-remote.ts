import type { SupabaseClient } from '@supabase/supabase-js'

import type { RemoteRow, TableName } from './collections'
import type { RemoteStore } from './engine'

const PAGE = 1000
const CHUNK = 400

/** `RemoteStore` sobre as tabelas do Supabase (RLS garante o isolamento por usuário). */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async pull(table: TableName, since: string | null): Promise<RemoteRow[]> {
      const rows: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client.from(table).select('id, data, updated_at, deleted_at').order('updated_at').order('id')
        if (since) q = q.gte('updated_at', since)
        const { data, error } = await q.range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        rows.push(...(data as RemoteRow[]))
        if (data.length < PAGE) break
      }
      return rows
    },

    async push(table: TableName, changes: { id: string; data: unknown | null }[]): Promise<void> {
      const now = new Date().toISOString()
      for (let i = 0; i < changes.length; i += CHUNK) {
        const rows = changes.slice(i, i + CHUNK).map((c) => ({
          user_id: userId,
          id: c.id,
          // Exclusão lógica mantém o último conteúdo só para referência; `{}` basta.
          data: c.data ?? {},
          deleted_at: c.data === null ? now : null,
        }))
        const { error } = await client.from(table).upsert(rows, { onConflict: 'user_id,id' })
        if (error) throw new Error(error.message)
      }
    },
  }
}
