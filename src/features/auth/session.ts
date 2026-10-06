/**
 * Sessão (login com Google via Supabase) + ciclo de vida da sincronização.
 *
 * Fluxo: sem sessão → tela de login. Com sessão → aponta o estado local para
 * o cache do usuário, baixa o que há no servidor e libera o app. Se a conta
 * estiver vazia e este navegador tiver dados da versão sem conta, oferece
 * importar.
 */
import type { User } from '@supabase/supabase-js'
import { create } from 'zustand'

import { cloudEnabled, supabase } from '@/lib/supabase'
import { migrateData, type AppData } from '@/services/app-data'
import { createLocalStorageAdapter, readLegacyData } from '@/services/storage'
import { hasContent } from '@/services/sync/collections'
import { SyncEngine, type SyncState } from '@/services/sync/engine'
import { createSupabaseRemote } from '@/services/sync/supabase-remote'
import { clearScopedCache, getAppData, setAppData, subscribeAppData, switchDataScope, useAppStore } from '@/store/app-store'

export type SessionPhase = 'local' | 'loading' | 'signedOut' | 'unreachable' | 'ready'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
  avatarUrl: string | null
}

interface SessionState {
  phase: SessionPhase
  user: SessionUser | null
  sync: SyncState | null
  /** Dados da versão sem conta encontrados neste navegador (oferta de importação). */
  legacyOffer: AppData | null
  authError: string | null
}

const LEGACY_HANDLED_KEY = 'forja.legacy.handled'
const storage = createLocalStorageAdapter()
const kv = {
  getItem: (k: string) => storage.getItem(k) as string | null,
  setItem: (k: string, v: string) => void storage.setItem(k, v),
  removeItem: (k: string) => void storage.removeItem(k),
}

export const useSession = create<SessionState>(() => ({
  phase: cloudEnabled ? 'loading' : 'local',
  user: null,
  sync: null,
  legacyOffer: null,
  authError: readAuthErrorFromUrl(),
}))

let engine: SyncEngine | null = null
let currentUserId: string | null = null
let started = false

function toSessionUser(u: User): SessionUser {
  const meta = u.user_metadata as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    id: u.id,
    email: u.email ?? null,
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: str(meta.avatar_url) ?? str(meta.picture),
  }
}

function readAuthErrorFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search || window.location.hash.slice(1))
  const msg = params.get('error_description')
  if (!msg) return null
  window.history.replaceState(null, '', window.location.pathname)
  return msg
}

/** Inicializa a sessão uma única vez (chamado pelo AuthGate). */
export function startSession(): void {
  if (started || !supabase) return
  started = true
  void supabase.auth.getSession().then(({ data }) => void handleUser(data.session?.user ?? null))
  supabase.auth.onAuthStateChange((_event, session) => {
    // Evita chamar o Supabase dentro do callback (recomendação da lib).
    setTimeout(() => void handleUser(session?.user ?? null), 0)
  })
}

async function handleUser(user: User | null): Promise<void> {
  const id = user?.id ?? null
  if (id === currentUserId) {
    if (user) useSession.setState({ user: toSessionUser(user) })
    else if (useSession.getState().phase === 'loading') useSession.setState({ phase: 'signedOut' })
    return
  }
  currentUserId = id
  engine?.stop()
  engine = null

  if (!user || !supabase) {
    await switchDataScope(null)
    useSession.setState({ phase: 'signedOut', user: null, sync: null, legacyOffer: null })
    return
  }

  useSession.setState({ phase: 'loading', user: toSessionUser(user), authError: null })
  await switchDataScope(user.id)

  const e = new SyncEngine({
    userId: user.id,
    remote: createSupabaseRemote(supabase, user.id),
    kv,
    getData: getAppData,
    setData: setAppData,
    subscribe: subscribeAppData,
    isOnline: () => navigator.onLine,
    pullIntervalMs: 2 * 60_000,
  })
  engine = e
  e.onChange((sync) => useSession.setState({ sync }))

  const { remoteEmpty, pulled } = await e.start()
  if (engine !== e) return // trocou de usuário no meio do caminho

  // Aparelho novo, sem cache e sem conseguir falar com o servidor: não deixa
  // começar do zero (isso sobrescreveria o perfil salvo na nuvem).
  if (!pulled && !e.hasPulled) {
    useSession.setState({ phase: 'unreachable' })
    return
  }

  useSession.setState({ phase: 'ready', legacyOffer: remoteEmpty ? findLegacyOffer() : null })
}

function findLegacyOffer(): AppData | null {
  if (kv.getItem(LEGACY_HANDLED_KEY)) return null
  if (hasContent(getAppData())) return null
  const legacy = readLegacyData(storage)
  if (!legacy) return null
  const data = migrateData(legacy.state, legacy.version)
  return hasContent(data) ? data : null
}

/* -------------------------------- ações -------------------------------- */

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) return
  useSession.setState({ authError: null })
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
  })
  if (error) useSession.setState({ authError: error.message })
}

/** Sai da conta. Retorna quantas alterações ficaram sem enviar (0 = tudo salvo). */
export async function signOut(options: { force?: boolean } = {}): Promise<number> {
  if (!supabase) return 0
  const pending = engine ? await engine.flush() : 0
  if (pending > 0 && !options.force) return pending
  // Privacidade em aparelhos compartilhados: o cache local da conta sai junto.
  engine?.forget()
  clearScopedCache()
  await supabase.auth.signOut()
  return 0
}

export function acceptLegacyImport(): void {
  const data = useSession.getState().legacyOffer
  if (!data) return
  kv.setItem(LEGACY_HANDLED_KEY, new Date().toISOString())
  useAppStore.getState().importData(data) // o diff enfileira tudo para envio
  useSession.setState({ legacyOffer: null })
}

export function declineLegacyImport(): void {
  kv.setItem(LEGACY_HANDLED_KEY, new Date().toISOString())
  useSession.setState({ legacyOffer: null })
}

export function syncNow(): void {
  void engine?.sync()
}

/** Nova tentativa depois de falha na primeira carga. */
export async function retryInitialSync(): Promise<void> {
  const e = engine
  if (!e) return
  useSession.setState({ phase: 'loading' })
  await e.sync()
  if (engine !== e) return
  useSession.setState({ phase: e.hasPulled ? 'ready' : 'unreachable' })
}

// Volta ao app / volta a conexão → sincroniza.
if (typeof window !== 'undefined' && cloudEnabled) {
  window.addEventListener('online', syncNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
    else void engine?.flush()
  })
}
