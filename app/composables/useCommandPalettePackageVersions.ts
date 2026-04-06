import type { MaybeRefOrGetter } from 'vue'
import { fetchAllPackageVersions } from '~/utils/npm/api'

export function useCommandPalettePackageVersions(
  packageName: MaybeRefOrGetter<string | null | undefined>,
) {
  const versions = shallowRef<string[] | null>(null)
  let pendingLoad: Promise<void> | null = null
  let invalidationToken = 0

  watch(
    () => toValue(packageName),
    () => {
      versions.value = null
      pendingLoad = null
      invalidationToken += 1
    },
  )

  async function ensureLoaded() {
    const resolvedPackageName = toValue(packageName)
    if (!resolvedPackageName || versions.value) return
    if (pendingLoad) return pendingLoad

    const token = invalidationToken

    async function doLoad(name: string) {
      try {
        const allVersions = await fetchAllPackageVersions(name)
        if (token !== invalidationToken) return
        versions.value = allVersions.map(version => version.version)
      } finally {
        if (pendingLoad === load) {
          pendingLoad = null
        }
      }
    }

    const load = doLoad(resolvedPackageName)
    pendingLoad = load
    return load
  }

  return {
    ensureLoaded,
    versions,
  }
}
