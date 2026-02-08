import type { Packument, SlimPackument, SlimVersion, SlimPackumentVersion } from '#shared/types'
import { extractInstallScriptsInfo } from '~/utils/install-scripts'

/** Number of recent versions to include in initial payload */
const RECENT_VERSIONS_COUNT = 5

/**
 * Transform a full Packument into a slimmed version for client-side use.
 * Reduces payload size by:
 * - Removing readme (fetched separately)
 * - Including only: 5 most recent versions + one version per dist-tag + requested version
 * - Stripping unnecessary fields from version objects
 */
function transformPackument(pkg: Packument, requestedVersion?: string | null): SlimPackument {
  // Get versions pointed to by dist-tags
  const distTagVersions = new Set(Object.values(pkg['dist-tags'] ?? {}))

  // Get 5 most recent versions by publish time
  const recentVersions = Object.keys(pkg.versions)
    .filter(v => pkg.time[v])
    .sort((a, b) => {
      const timeA = pkg.time[a]
      const timeB = pkg.time[b]
      if (!timeA || !timeB) return 0
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, RECENT_VERSIONS_COUNT)

  // Combine: recent versions + dist-tag versions + requested version (deduplicated)
  const includedVersions = new Set([...recentVersions, ...distTagVersions])

  // Add the requested version if it exists in the package
  if (requestedVersion && pkg.versions[requestedVersion]) {
    includedVersions.add(requestedVersion)
  }

  // Build filtered versions object with install scripts info per version
  const filteredVersions: Record<string, SlimVersion> = {}
  let versionData: SlimPackumentVersion | null = null
  for (const v of includedVersions) {
    const version = pkg.versions[v]
    if (version) {
      if (version.version === requestedVersion) {
        // Strip readme from each version, extract install scripts info
        const { readme: _readme, scripts, ...slimVersion } = version

        // Extract install scripts info (which scripts exist + npx deps)
        const installScripts = scripts ? extractInstallScriptsInfo(scripts) : null
        versionData = {
          ...slimVersion,
          installScripts: installScripts ?? undefined,
        }
      }
      filteredVersions[v] = {
        ...((version?.dist as { attestations?: unknown }) ? { hasProvenance: true } : {}),
        version: version.version,
        deprecated: version.deprecated,
        tags: version.tags as string[],
      }
    }
  }

  // Build filtered time object (only for included versions + metadata)
  const filteredTime: Record<string, string> = {}
  if (pkg.time.modified) filteredTime.modified = pkg.time.modified
  if (pkg.time.created) filteredTime.created = pkg.time.created
  for (const v of includedVersions) {
    if (pkg.time[v]) filteredTime[v] = pkg.time[v]
  }

  // Normalize license field
  let license = pkg.license
  if (license && typeof license === 'object' && 'type' in license) {
    license = license.type
  }

  return {
    '_id': pkg._id,
    '_rev': pkg._rev,
    'name': pkg.name,
    'description': pkg.description,
    'dist-tags': pkg['dist-tags'],
    'time': filteredTime,
    'maintainers': pkg.maintainers,
    'author': pkg.author,
    'license': license,
    'homepage': pkg.homepage,
    'keywords': pkg.keywords,
    'repository': pkg.repository,
    'bugs': pkg.bugs,
    'requestedVersion': versionData,
    'versions': filteredVersions,
  }
}

export function usePackage(
  name: MaybeRefOrGetter<string>,
  requestedVersion?: MaybeRefOrGetter<string | null>,
) {
  const asyncData = useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    async ({ $npmRegistry }, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data: r, isStale } = await $npmRegistry<Packument>(`/${encodedName}`, {
        signal,
      })
      const reqVer = toValue(requestedVersion)
      const pkg = transformPackument(r, reqVer)
      return { ...pkg, isStale }
    },
  )

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}
