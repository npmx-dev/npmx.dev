import type { PackageVersionInfo } from '#shared/types'
import { getVersions } from 'fast-npm-meta'
import { compare } from 'semver'

export function usePackageVersionHistory(name: MaybeRefOrGetter<string>) {
  return useLazyAsyncData(
    () => `package-versions:${toValue(name)}`,
    async () => {
      const data = await getVersions(toValue(name), { metadata: true })

      const versions: PackageVersionInfo[] = Object.entries(data.versionsMeta)
        .map(([version, meta]) => ({
          version,
          time: meta.time,
          hasProvenance: meta.provenance === 'trustedPublisher' || meta.provenance === true,
          deprecated: meta.deprecated,
        }))
        .sort((a, b) => compare(b.version, a.version))

      return {
        distTags: data.distTags as Record<string, string>,
        versions,
      }
    },
  )
}
