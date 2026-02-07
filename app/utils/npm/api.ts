import type { PackageVersionInfo } from '#shared/types'
import { getVersions } from 'fast-npm-meta'
import { compare } from 'semver'

type NpmDownloadsRangeResponse = {
  start: string
  end: string
  package: string
  downloads: Array<{ day: string; downloads: number }>
}

/**
 * Fetch download range data from npm API.
 * Exported for external use (e.g., in components).
 */
export async function fetchNpmDownloadsRange(
  packageName: string,
  start: string,
  end: string,
): Promise<NpmDownloadsRangeResponse> {
  const { $npmApi } = useNuxtApp()
  const encodedName = encodePackageName(packageName)
  return (
    await $npmApi<NpmDownloadsRangeResponse>(`/downloads/range/${start}:${end}/${encodedName}`)
  ).data
}

// ============================================================================
// Package Versions
// ============================================================================

// Cache for full version lists (client-side only, for non-composable usage)
const allVersionsCache = new Map<string, Promise<PackageVersionInfo[]>>()

/**
 * Fetch all versions of a package using fast-npm-meta API.
 * Returns version info sorted by version (newest first).
 * Results are cached to avoid duplicate requests.
 *
 * Note: This is a standalone async function for use in event handlers.
 * For composable usage, use useAllPackageVersions instead.
 *
 * @see https://github.com/antfu/fast-npm-meta
 */
export async function fetchAllPackageVersions(packageName: string): Promise<PackageVersionInfo[]> {
  const cached = allVersionsCache.get(packageName)
  if (cached) return cached

  const promise = (async () => {
    const data = await getVersions(packageName, { metadata: true })

    return Object.entries(data.versionsMeta)
      .map(([version, meta]) => ({
        version,
        time: meta.time,
        hasProvenance: meta.provenance === 'trustedPublisher' || meta.provenance === true,
        deprecated: meta.deprecated,
      }))
      .sort((a, b) => compare(b.version, a.version))
  })()

  allVersionsCache.set(packageName, promise)
  return promise
}
