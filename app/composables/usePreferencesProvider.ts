/**
 * Abstraction for preferences storage
 * Currently uses localStorage, designed for future user prefs API
 */

const STORAGE_KEY = 'npmx-list-prefs'

interface StorageProvider<T> {
  get: () => T | null
  set: (value: T) => void
  remove: () => void
}

/**
 * Creates a localStorage-based storage provider
 */
function createLocalStorageProvider<T>(key: string): StorageProvider<T> {
  return {
    get: () => {
      if (import.meta.server) return null
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          return JSON.parse(stored) as T
        }
      } catch {
        // Corrupted data, remove it
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

// Future: API-based provider would look like this:
// function createApiStorageProvider<T>(endpoint: string): StorageProvider<T> {
//   return {
//     get: async () => { /* fetch from API */ },
//     set: async (value) => { /* POST to API */ },
//     remove: async () => { /* DELETE from API */ },
//   }
// }

/**
 * Composable for managing preferences storage
 * Abstracts the storage mechanism to allow future migration to API-based storage
 *
 * @public
 */
export function usePreferencesProvider<T>(defaultValue: T) {
  const provider = createLocalStorageProvider<T>(STORAGE_KEY)
  const data = ref<T>(defaultValue) as Ref<T>
  const isHydrated = ref(false)

  // Load from storage on client
  onMounted(() => {
    const stored = provider.get()
    if (stored) {
      // Merge stored values with defaults to handle schema evolution
      data.value = { ...defaultValue, ...stored }
    }
    isHydrated.value = true
  })

  // Persist changes
  function save() {
    provider.set(data.value)
  }

  // Reset to defaults
  function reset() {
    data.value = { ...defaultValue }
    provider.remove()
  }

  // Update specific keys
  function update<K extends keyof T>(key: K, value: T[K]) {
    data.value[key] = value
    save()
  }

  return {
    data,
    isHydrated,
    save,
    reset,
    update,
  }
}
