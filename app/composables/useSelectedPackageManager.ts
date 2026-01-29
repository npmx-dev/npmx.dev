/** @public */
export function useSelectedPackageManager() {
  return useLocalStorage<PackageManagerId>('npmx-pm', 'npm')
}
