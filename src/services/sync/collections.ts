/**
 * Mapeamento AppData ⇄ linhas remotas (uma tabela por tipo de entidade).
 * Tudo aqui é puro: diff entre dois estados e aplicação de linhas recebidas.
 */
import type { AppData, Profile, Settings } from '@/services/app-data'

export const TABLES = [
  'profiles',
  'habits',
  'habit_logs',
  'tasks',
  'day_records',
  'ledger_entries',
  'achievements',
  'skills',
  'skill_practices',
  'skill_links',
] as const
export type TableName = (typeof TABLES)[number]

/** Linha como vem do servidor. */
export interface RemoteRow {
  id: string
  data: unknown
  updated_at: string
  deleted_at: string | null
}

/** Mudança local a enviar (`data: null` = exclusão). */
export interface Change {
  table: TableName
  id: string
  data: unknown | null
}

export const PROFILE_ROW_ID = 'main'

export interface ProfileDoc {
  profile: Profile
  settings: Settings
}

type ListKey = 'habits' | 'logs' | 'tasks' | 'ledger' | 'skills' | 'skillPractices' | 'skillLinks'
type MapKey = 'records' | 'achievements'

interface ListCollection {
  kind: 'list'
  table: TableName
  key: ListKey
  idOf: (item: never) => string
}
interface MapCollection {
  kind: 'map'
  table: TableName
  key: MapKey
}
type Collection = ListCollection | MapCollection

const byId = (item: { id: string }) => item.id

export const COLLECTIONS: readonly Collection[] = [
  { kind: 'list', table: 'habits', key: 'habits', idOf: byId },
  { kind: 'list', table: 'habit_logs', key: 'logs', idOf: byId },
  { kind: 'list', table: 'tasks', key: 'tasks', idOf: byId },
  { kind: 'map', table: 'day_records', key: 'records' },
  { kind: 'list', table: 'ledger_entries', key: 'ledger', idOf: byId },
  { kind: 'map', table: 'achievements', key: 'achievements' },
  { kind: 'list', table: 'skills', key: 'skills', idOf: byId },
  { kind: 'list', table: 'skill_practices', key: 'skillPractices', idOf: byId },
  {
    kind: 'list',
    table: 'skill_links',
    key: 'skillLinks',
    idOf: (l: { habitId: string; skillId: string }) => `${l.habitId}:${l.skillId}`,
  },
]

function entries(data: AppData, c: Collection): Map<string, unknown> {
  if (c.kind === 'map') return new Map(Object.entries(data[c.key]))
  const idOf = c.idOf as (item: unknown) => string
  return new Map((data[c.key] as unknown[]).map((item) => [idOf(item), item]))
}

/**
 * Diferença entre dois estados. Os comandos são imutáveis, então comparar por
 * referência basta: objeto novo = entidade alterada.
 */
export function diffData(prev: AppData, next: AppData): Change[] {
  const changes: Change[] = []
  if (prev.profile !== next.profile || prev.settings !== next.settings) {
    changes.push({ table: 'profiles', id: PROFILE_ROW_ID, data: { profile: next.profile, settings: next.settings } satisfies ProfileDoc })
  }
  for (const c of COLLECTIONS) {
    if (prev[c.key] === next[c.key]) continue
    const before = entries(prev, c)
    const after = entries(next, c)
    for (const [id, item] of after) if (before.get(id) !== item) changes.push({ table: c.table, id, data: item })
    for (const id of before.keys()) if (!after.has(id)) changes.push({ table: c.table, id, data: null })
  }
  return changes
}

/** Todas as entidades do estado como mudanças (importação / primeiro envio). */
export function allChanges(data: AppData): Change[] {
  const changes: Change[] = [{ table: 'profiles', id: PROFILE_ROW_ID, data: { profile: data.profile, settings: data.settings } }]
  for (const c of COLLECTIONS) for (const [id, item] of entries(data, c)) changes.push({ table: c.table, id, data: item })
  return changes
}

function sameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Aplica linhas recebidas de uma tabela. `skip` diz quais ids têm mudança
 * local pendente (a versão local vence até ser enviada). Retorna o mesmo
 * objeto quando nada muda, para não disparar renderizações.
 */
export function applyRows(data: AppData, table: TableName, rows: RemoteRow[], skip: (id: string) => boolean = () => false): AppData {
  const relevant = rows.filter((r) => !skip(r.id))
  if (relevant.length === 0) return data

  if (table === 'profiles') {
    const row = relevant.find((r) => r.id === PROFILE_ROW_ID)
    if (!row || row.deleted_at) return data
    const doc = row.data as Partial<ProfileDoc>
    const profile = { ...data.profile, ...doc.profile }
    const settings = { ...data.settings, ...doc.settings }
    if (sameJson(profile, data.profile) && sameJson(settings, data.settings)) return data
    return { ...data, profile, settings }
  }

  const c = COLLECTIONS.find((x) => x.table === table)
  if (!c) return data
  const current = entries(data, c)
  let changed = false
  for (const row of relevant) {
    if (row.deleted_at) {
      if (current.delete(row.id)) changed = true
    } else if (!sameJson(current.get(row.id), row.data)) {
      current.set(row.id, row.data)
      changed = true
    }
  }
  if (!changed) return data
  if (c.kind === 'map') return { ...data, [c.key]: Object.fromEntries(current) }
  return { ...data, [c.key]: [...current.values()] }
}

/** Há algo além do estado vazio? (decide se vale oferecer importação) */
export function hasContent(data: AppData): boolean {
  return data.profile.onboardedAt !== null || data.habits.length > 0 || data.tasks.length > 0 || data.skills.length > 0
}
