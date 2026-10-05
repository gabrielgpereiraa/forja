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
