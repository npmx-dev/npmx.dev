import { useLocalStorage } from '@vueuse/core'

export function useSelectedPackageManager() {
  return useLocalStorage<PackageManagerId>('npmx-pm', 'npm')
}
