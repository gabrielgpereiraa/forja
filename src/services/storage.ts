import type { StateStorage } from 'zustand/middleware'

/**
 * Adaptador de armazenamento. Hoje: localStorage com fallback em memória
 * (modo privado, cota estourada). Amanhã: IndexedDB, sync remoto etc.
 */
export interface StorageAdapter extends StateStorage {
  readonly kind: string
}

function createMemoryStorage(): StorageAdapter {
  const mem = new Map<string, string>()
  return {
    kind: 'memory',
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  }
}

export function createLocalStorageAdapter(): StorageAdapter {
  const fallback = createMemoryStorage()
  const available = (() => {
    try {
      const key = '__forja_probe__'
      window.localStorage.setItem(key, '1')
      window.localStorage.removeItem(key)
      return true
    } catch {
      return false
    }
  })()
  if (!available) return fallback
  return {
    kind: 'localStorage',
    getItem: (k) => {
      try {
        return window.localStorage.getItem(k)
      } catch {
        return fallback.getItem(k) as string | null
      }
    },
    setItem: (k, v) => {
      try {
        window.localStorage.setItem(k, v)
      } catch {
        fallback.setItem(k, v)
      }
    },
    removeItem: (k) => {
      try {
        window.localStorage.removeItem(k)
      } catch {
        fallback.removeItem(k)
      }
    },
  }
}

export const STORAGE_KEY = 'forja.data'

/**
 * Armazenamento com escopo por usuário (`forja.data.<userId>`) e pausa de
 * escrita — usado para trocar de conta sem que o estado de uma vaze para a
 * chave da outra.
 */
export interface ScopedStorage extends StorageAdapter {
  scope: string | null
  paused: boolean
}

export function createScopedStorage(inner: StorageAdapter): ScopedStorage {
  const s: ScopedStorage = {
    kind: `scoped:${inner.kind}`,
    scope: null,
    paused: false,
    getItem: (k) => inner.getItem(s.scope ? `${k}.${s.scope}` : k),
    setItem: (k, v) => {
      if (!s.paused) return inner.setItem(s.scope ? `${k}.${s.scope}` : k, v)
    },
    removeItem: (k) => inner.removeItem(s.scope ? `${k}.${s.scope}` : k),
  }
  return s
}

/** Lê os dados salvos sem conta (v1) neste navegador, se houver. */
export function readLegacyData(storage: StorageAdapter): { state: unknown; version: number } | null {
  try {
    const raw = storage.getItem(STORAGE_KEY) as string | null
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: unknown; version?: number }
    return parsed.state ? { state: parsed.state, version: parsed.version ?? 0 } : null
  } catch {
    return null
  }
}
