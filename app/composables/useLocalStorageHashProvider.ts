import defu from 'defu'
import { createLocalStorageProvider } from '~/utils/storage'

export function useLocalStorageHashProvider<T extends object>(key: string, defaultValue: T) {
  const provider = createLocalStorageProvider<T>(key)
  const data = ref<T>(defaultValue)

  onMounted(() => {
    const stored = provider.get()
    if (stored) {
      data.value = defu(stored, defaultValue)
    }
  })

  function save() {
    provider.set(data.value)
  }

  function reset() {
    data.value = { ...defaultValue }
    provider.remove()
  }

  function update<K extends keyof T>(key: K, value: T[K]) {
    data.value[key] = value
    save()
  }

  return {
    data,
    save,
    reset,
    update,
  }
}
