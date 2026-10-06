/**
 * Motor de sincronização local-first.
 *
 * - O app sempre lê e escreve no estado local (instantâneo, funciona offline).
 * - Cada alteração vira uma entrada na "caixa de saída" (persistida), que é
 *   enviada em lote para o servidor; se falhar, tenta de novo depois.
 * - Periodicamente (e ao voltar para o app) baixa o que mudou no servidor desde
 *   o último cursor e aplica localmente. Entidades com envio pendente mantêm a
 *   versão local até serem enviadas.
 * - Conflito: a última escrita que chega ao servidor vence (por entidade).
 *
 * Não conhece Supabase nem React: recebe um `RemoteStore` e funções de acesso
 * ao estado — o que permite testar tudo com dublês em memória.
 */
import type { AppData } from '@/services/app-data'
import { applyRows, diffData, type Change, type RemoteRow, type TableName, TABLES } from './collections'

export interface RemoteStore {
  /** Linhas com `updated_at >= since` (todas, se `since` for null). */
  pull: (table: TableName, since: string | null) => Promise<RemoteRow[]>
  /** Upsert em lote; `data: null` marca exclusão. */
  push: (table: TableName, changes: { id: string; data: unknown | null }[]) => Promise<void>
}

export interface KeyValueStore {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: number | null
  error: string | null
}

export interface SyncEngineOptions {
  userId: string
  remote: RemoteStore
  kv: KeyValueStore
  getData: () => AppData
  setData: (data: AppData) => void
  /** Assina mudanças do estado; retorna a função para cancelar. */
  subscribe: (listener: (next: AppData, prev: AppData) => void) => () => void
  isOnline?: () => boolean
  pushDelayMs?: number
  pullIntervalMs?: number
}

interface OutboxEntry extends Change {
  /** Incrementa a cada nova alteração da mesma entidade (detecta edição durante o envio). */
  v: number
}

/** Margem para transações concorrentes que gravaram com timestamp anterior ao cursor. */
const CURSOR_OVERLAP_MS = 60_000
const RETRY_DELAYS_MS = [3_000, 10_000, 30_000, 60_000]

export class SyncEngine {
  private outbox = new Map<string, OutboxEntry>()
  private cursors: Partial<Record<TableName, string>> = {}
  private listeners = new Set<(s: SyncState) => void>()
  private unsubscribe: (() => void) | null = null
  private applying = false
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pullTimer: ReturnType<typeof setInterval> | null = null
  private pushing: Promise<void> | null = null
  private pulling: Promise<boolean> | null = null
  private retry = 0
  private stopped = false
  state: SyncState = { status: 'idle', pending: 0, lastSyncedAt: null, error: null }

  private readonly opts: SyncEngineOptions

  constructor(opts: SyncEngineOptions) {
    this.opts = opts
    this.outbox = this.load<OutboxEntry[]>('outbox', []).reduce((m, e) => m.set(keyOf(e.table, e.id), e), new Map<string, OutboxEntry>())
    this.cursors = this.load('cursors', {})
    this.state = { ...this.state, pending: this.outbox.size, lastSyncedAt: this.load<number | null>('lastSyncedAt', null) }
  }

  /* ----------------------------- ciclo de vida ----------------------------- */

  /** Começa a observar o estado e faz a primeira sincronização. */
  async start(): Promise<{ remoteEmpty: boolean; pulled: boolean }> {
    this.unsubscribe = this.opts.subscribe((next, prev) => {
      if (this.applying || this.stopped) return
      this.enqueue(diffData(prev, next))
    })
    const remoteEmpty = await this.pull()
    const pulled = this.state.status === 'idle'
    if (this.outbox.size > 0) await this.push()
    if (this.opts.pullIntervalMs) this.pullTimer = setInterval(() => void this.sync(), this.opts.pullIntervalMs)
    return { remoteEmpty, pulled }
  }

  stop(): void {
    this.stopped = true
    this.unsubscribe?.()
    if (this.pushTimer) clearTimeout(this.pushTimer)
    if (this.pullTimer) clearInterval(this.pullTimer)
    this.listeners.clear()
  }

  /** Já houve uma carga completa do servidor neste aparelho? */
  get hasPulled(): boolean {
    return Object.keys(this.cursors).length > 0 || this.state.lastSyncedAt !== null
  }

  /** Envia o pendente e baixa novidades. */
  async sync(): Promise<void> {
    if (this.stopped) return
    await this.push()
    await this.pull()
  }

  /** Tenta enviar tudo agora; retorna quantas alterações continuam pendentes. */
  async flush(): Promise<number> {
    if (this.pushTimer) clearTimeout(this.pushTimer)
    await this.push()
    return this.outbox.size
  }

  /** Apaga caixa de saída e cursores deste usuário (ex.: ao sair da conta). */
  forget(): void {
    for (const name of ['outbox', 'cursors', 'lastSyncedAt']) this.opts.kv.removeItem(this.key(name))
  }

  onChange(listener: (s: SyncState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  /** Marca entidades para envio (usado também na importação de dados locais). */
  enqueue(changes: Change[]): void {
    if (changes.length === 0) return
    for (const c of changes) {
      const k = keyOf(c.table, c.id)
      this.outbox.set(k, { ...c, v: (this.outbox.get(k)?.v ?? 0) + 1 })
    }
    this.saveOutbox()
    this.update({ pending: this.outbox.size })
    this.schedulePush(this.opts.pushDelayMs ?? 1200)
  }

  /* -------------------------------- envio -------------------------------- */

  private schedulePush(delay: number): void {
    if (this.stopped) return
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.push(), delay)
  }

  private push(): Promise<void> {
    if (this.pushing) return this.pushing.then(() => (this.outbox.size > 0 && !this.stopped ? this.push() : undefined))
    if (this.outbox.size === 0 || this.stopped) return Promise.resolve()
    if (!this.online()) {
      this.update({ status: 'offline' })
      return Promise.resolve()
    }
    this.pushing = this.doPush().finally(() => (this.pushing = null))
    return this.pushing
  }

  private async doPush(): Promise<void> {
    const batch = [...this.outbox.values()]
    this.update({ status: 'syncing' })
    try {
      for (const table of TABLES) {
        const items = batch.filter((e) => e.table === table)
        if (items.length) await this.opts.remote.push(table, items.map(({ id, data }) => ({ id, data })))
      }
      for (const e of batch) {
        const k = keyOf(e.table, e.id)
        if (this.outbox.get(k)?.v === e.v) this.outbox.delete(k)
      }
      this.saveOutbox()
      this.retry = 0
      this.synced()
      if (this.outbox.size > 0) this.schedulePush(300)
    } catch (err) {
      this.failed(err)
    }
  }

  /* ------------------------------- download ------------------------------- */

  /** Retorna `true` quando foi uma carga completa e o servidor não tinha nada. */
  private pull(): Promise<boolean> {
    if (this.pulling) return this.pulling
    if (this.stopped) return Promise.resolve(false)
    if (!this.online()) {
      this.update({ status: 'offline' })
      return Promise.resolve(false)
    }
    this.pulling = this.doPull().finally(() => (this.pulling = null))
    return this.pulling
  }

  private async doPull(): Promise<boolean> {
    this.update({ status: 'syncing' })
    const full = Object.keys(this.cursors).length === 0
    let total = 0
    try {
      const results: [TableName, RemoteRow[]][] = []
      for (const table of TABLES) {
        const since = this.cursors[table]
        const rows = await this.opts.remote.pull(table, since ? new Date(Date.parse(since) - CURSOR_OVERLAP_MS).toISOString() : null)
        results.push([table, rows])
        total += rows.length
      }
      let data = this.opts.getData()
      for (const [table, rows] of results) {
        data = applyRows(data, table, rows, (id) => this.outbox.has(keyOf(table, id)))
        const max = rows.reduce<string | undefined>((m, r) => (!m || r.updated_at > m ? r.updated_at : m), this.cursors[table])
        if (max) this.cursors[table] = max
      }
      if (data !== this.opts.getData()) this.applyRemote(data)
      this.save('cursors', this.cursors)
      this.retry = 0
      this.synced()
      return full && total === 0
    } catch (err) {
      this.failed(err)
      return false
    }
  }

  private applyRemote(data: AppData): void {
    this.applying = true
    try {
      this.opts.setData(data)
    } finally {
      this.applying = false
    }
  }

  /* -------------------------------- estado -------------------------------- */

  private synced(): void {
    const now = Date.now()
    this.save('lastSyncedAt', now)
    this.update({ status: 'idle', error: null, lastSyncedAt: now, pending: this.outbox.size })
  }

  private failed(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err)
    this.update({ status: this.online() ? 'error' : 'offline', error: message, pending: this.outbox.size })
    const delay = RETRY_DELAYS_MS[Math.min(this.retry, RETRY_DELAYS_MS.length - 1)] ?? 60_000
    this.retry += 1
    if (this.outbox.size > 0) this.schedulePush(delay)
  }

  private update(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  private online(): boolean {
    return this.opts.isOnline ? this.opts.isOnline() : true
  }

  private key(name: string): string {
    return `forja.sync.${this.opts.userId}.${name}`
  }

  private load<T>(name: string, fallback: T): T {
    try {
      const raw = this.opts.kv.getItem(this.key(name))
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  }

  private save(name: string, value: unknown): void {
    try {
      this.opts.kv.setItem(this.key(name), JSON.stringify(value))
    } catch {
      /* cota cheia: segue em memória */
    }
  }

  private saveOutbox(): void {
    this.save('outbox', [...this.outbox.values()])
  }
}

function keyOf(table: TableName, id: string): string {
  return `${table}/${id}`
}
