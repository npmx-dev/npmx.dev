import { getTrustStatus } from 'packumeta'
import { extractInstallScriptsInfo } from '#shared/utils/install-scripts'
import { normalizeLicense } from '#shared/utils/npm'
import { detectSecurityDowngradeForVersion } from '~/utils/publish-security'
import type {
  Packument,
  SlimPackument,
  SlimPackumentVersion,
  SlimVersion,
} from '#shared/types/npm-registry'

/** Number of recent versions to include in initial payload */
const RECENT_VERSIONS_COUNT = 5

/**
 * Transform a full Packument into a slimmed version for client-side use.
 * Reduces payload size by:
 * - Removing readme (fetched separately)
 * - Including only: 5 most recent versions + one version per dist-tag + requested version
 * - Stripping unnecessary fields from version objects
 *
 * This runs server-side in the `/api/registry/packument` route, so the full
 * packument never has to be sent to (or parsed by) the client.
 *
 * @param pkg Full packument as returned by the npm registry
 * @param requestedVersion Version the caller wants full metadata for (optional)
 */
export function transformPackument(
  pkg: Packument,
  requestedVersion?: string | null,
): SlimPackument {
  // Get versions pointed to by dist-tags
  const distTagVersions = new Set(Object.values(pkg['dist-tags'] ?? {}))

  // Get 5 most recent versions by publish time
  const recentVersions = Object.keys(pkg.versions)
    .filter(v => pkg.time[v])
    .sort((a, b) => {
      const timeA = pkg.time[a]
      const timeB = pkg.time[b]
      if (!timeA || !timeB) return 0
      return Date.parse(timeB) - Date.parse(timeA)
    })
    .slice(0, RECENT_VERSIONS_COUNT)

  // Combine: recent versions + dist-tag versions + requested version (deduplicated)
  const includedVersions = new Set([...recentVersions, ...distTagVersions])

  // Add the requested version if it exists in the package
  if (requestedVersion && pkg.versions[requestedVersion]) {
    includedVersions.add(requestedVersion)
  }

  // Computed from the full version history so only the small result is serialized.
  const securityVersionEntries = Object.entries(pkg.versions).map(([version, metadata]) => ({
    version,
    time: pkg.time[version],
    trustStatus: getTrustStatus(metadata),
    deprecated: metadata.deprecated,
  }))
  const publishSecurityDowngrade = requestedVersion
    ? detectSecurityDowngradeForVersion(securityVersionEntries, requestedVersion)
    : null

  // Build filtered versions object with install scripts info per version
  const filteredVersions: Record<string, SlimVersion> = {}
  let versionData: SlimPackumentVersion | null = null
  for (const v of includedVersions) {
    const version = pkg.versions[v]
    if (version) {
      const versionLicense = normalizeLicense(version.license)
      if (version.version === requestedVersion) {
        // Strip readme from each version, extract install scripts info
        const { readme: _readme, scripts, ...slimVersion } = version

        // Extract install scripts info (which scripts exist + npx deps)
        const installScripts = scripts ? extractInstallScriptsInfo(scripts) : null
        versionData = {
          ...slimVersion,
          license: versionLicense,
          installScripts: installScripts ?? undefined,
        }
      }

      filteredVersions[v] = {
        trustStatus: getTrustStatus(version),
        version: version.version,
        deprecated: version.deprecated,
        tags: version.tags as string[],
        license: versionLicense,
        type: typeof version.type === 'string' ? version.type : undefined,
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
  const license = normalizeLicense(requestedVersion ? versionData?.license : pkg.license)

  // Extract storybook field from the requested version (custom package.json field)
  const requestedPkgVersion = requestedVersion ? pkg.versions[requestedVersion] : null
  const rawStorybook = requestedPkgVersion?.storybook
  const storybook =
    rawStorybook && typeof rawStorybook === 'object' && 'url' in rawStorybook
      ? ({ url: rawStorybook.url } as { url: string })
      : undefined

  return {
    // oxlint-disable-next-line eslint/no-underscore-dangle
    '_id': pkg._id,
    // oxlint-disable-next-line eslint/no-underscore-dangle
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
    ...(storybook && { storybook }),
    'requestedVersion': versionData,
    'versions': filteredVersions,
    'publishSecurityDowngrade': publishSecurityDowngrade,
  }
}
