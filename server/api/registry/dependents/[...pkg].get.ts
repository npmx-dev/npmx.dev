import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

const E18E_LIVE_REGISTRY_URL = 'https://npm.devminer.xyz/live_registry'
const E18E_REGISTRY_URL = 'https://npm.devminer.xyz/registry'

interface DependentsViewResponse {
  total_rows: number
  offset: number
  rows: {
    id: string
    key: string
    value: { name: string; version: string }
  }[]
}

interface DownloadsViewResponse {
  total_rows: number
  offset: number
  rows: {
    id: string
    key: string
    value: number
  }[]
}

export interface DependentPackage {
  name: string
  downloads: number
  version?: string
}

export interface DependentsResponse {
  dependents: DependentPackage[]
  total: number
}

/**
 * GET /api/registry/dependents/:name
 *
 * Fetch packages that depend on the given package using the e18e CouchDB mirror.
 * Uses CouchDB views for efficient lookups, then fetches download stats separately.
 * Results are sorted by download count (most downloaded first) for security triage.
 */
export default defineCachedEventHandler(
  async (event): Promise<DependentsResponse> => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
      })

      const dependentsResponse = await $fetch<DependentsViewResponse>(
        `${E18E_LIVE_REGISTRY_URL}/_design/dependents/_view/dependents2?key=${encodeURIComponent(JSON.stringify(packageName))}&limit=250`,
      )

      if (dependentsResponse.rows.length === 0) {
        return { dependents: [], total: 0 }
      }

      const packageNames = dependentsResponse.rows.map(row => row.value.name)

      const downloadsResponse = await $fetch<DownloadsViewResponse>(
        `${E18E_REGISTRY_URL}/_design/downloads/_view/downloads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { keys: packageNames },
        },
      )

      const downloadsMap = new Map<string, number>()
      for (const row of downloadsResponse.rows) {
        downloadsMap.set(row.key, row.value)
      }

      const versionMap = new Map<string, string>()
      for (const row of dependentsResponse.rows) {
        versionMap.set(row.value.name, row.value.version)
      }

      const dependents: DependentPackage[] = packageNames
        .map(name => ({
          name,
          downloads: downloadsMap.get(name) ?? 0,
          version: versionMap.get(name),
        }))
        .sort((a, b) => b.downloads - a.downloads)

      return {
        dependents,
        total: dependents.length,
      }
    } catch {
      return {
        dependents: [],
        total: 0,
      }
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `dependents:v2:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
