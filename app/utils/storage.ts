export interface StorageProvider<T> {
  get: () => T | null
  set: (value: T) => void
  remove: () => void
}

export function createLocalStorageProvider<T>(key: string): StorageProvider<T> {
  return {
    get: () => {
      if (import.meta.server) return null
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          return JSON.parse(stored) as T
        }
      } catch {
        localStorage.removeItem(key)
      }
      return null
    },
    set: (value: T) => {
      if (import.meta.server) return
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // Storage full or other error, fail silently
      }
    },
    remove: () => {
      if (import.meta.server) return
      localStorage.removeItem(key)
    },
  }
}
