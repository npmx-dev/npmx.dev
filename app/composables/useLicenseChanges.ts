import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export interface LicenseChange {
  from: string
  to: string
  version: string
}

export interface LicenseChangesResult {
  changes: LicenseChange[]
}

// Type definitions for npm registry response
interface NpmRegistryVersion {
  version: string
  license?: string
}

// for registry responses of $fetch function, the type includes the key versions as well as many others too.
interface NpmRegistryResponse {
  time: Record<string, string>
  versions: Record<string, NpmRegistryVersion>
}

/**
 * Composable to detect license changes across all versions of a package
 */
export function useLicenseChanges(
  packageName: MaybeRefOrGetter<string | null | undefined>,
  resolvedVersion: MaybeRefOrGetter<string | null | undefined> = () => undefined,
) {
  return useAsyncData<LicenseChangesResult>(
    () => {
      const name = toValue(packageName)
      const version = toValue(resolvedVersion) ?? 'latest'
      return `license-changes:${name}:${version}`
    },
    async () => {
      const name = toValue(packageName)
      const resolvedVer = toValue(resolvedVersion)
      if (!name) return { changes: [] }

      // Fetch full package metadata from npm registry
      const url = `https://registry.npmjs.org/${name}`
      const data = await $fetch<NpmRegistryResponse>(url)

      const changes: LicenseChange[] = []

      // `data.versions` is an object with version keys
      const versions = Object.values(data.versions) as NpmRegistryVersion[]

      // Sort versions ascending to compare chronologically
      versions.sort((a, b) => {
        const dateA = new Date(data.time[a.version] as string).getTime()
        const dateB = new Date(data.time[b.version] as string).getTime()

        // Ascending order (oldest to newest)
        return dateA - dateB
      })

      // When resolvedVer is not provided, check changes across all versions
      const targetVersion = resolvedVer ?? versions[versions.length - 1]?.version

      if (targetVersion) {
        const resolvedIndex = versions.findIndex(v => v.version === targetVersion)

        if (resolvedIndex > 0) {
          const currentLicense = (versions[resolvedIndex]?.license as string) ?? 'UNKNOWN'
          const previousLicense = (versions[resolvedIndex - 1]?.license as string) ?? 'UNKNOWN'

          if (currentLicense !== previousLicense) {
            changes.push({
              from: previousLicense,
              to: currentLicense,
              version: (versions[resolvedIndex]?.version as string) || 'UNKNOWN',
            })
          }
        }
      }
      return { changes }
    },
    {
      default: () => ({ changes: [] }),
      watch: [() => toValue(packageName), () => toValue(resolvedVersion)],
    },
  )
}
