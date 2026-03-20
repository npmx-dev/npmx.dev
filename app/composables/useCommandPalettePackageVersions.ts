import type { MaybeRefOrGetter } from 'vue'
import { fetchAllPackageVersions } from '~/utils/npm/api'

export function useCommandPalettePackageVersions(
  packageName: MaybeRefOrGetter<string | null | undefined>,
) {
  const versions = shallowRef<string[] | null>(null)
  let versionsPromise: Promise<void> | null = null

  watch(
    () => toValue(packageName),
    () => {
      versions.value = null
      versionsPromise = null
    },
  )

  async function ensureLoaded() {
    const resolvedPackageName = toValue(packageName)
    if (!resolvedPackageName || versions.value) return
    if (versionsPromise) return versionsPromise

    versionsPromise = fetchAllPackageVersions(resolvedPackageName)
      .then(allVersions => {
        if (toValue(packageName) !== resolvedPackageName) return
        versions.value = allVersions.map(version => version.version)
      })
      .finally(() => {
        versionsPromise = null
      })

    return versionsPromise
  }

  return {
    ensureLoaded,
    versions,
  }
}
