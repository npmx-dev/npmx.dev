import * as v from 'valibot'
import { hash } from 'ohash'
import { createError, getRouterParam, getQuery, setHeader } from 'h3'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR, ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { fetchNpmPackage } from '#server/utils/npm'
import { assertValidPackageName } from '#shared/utils/npm'
import { handleApiError } from '#server/utils/error-handler'

const NPM_DOWNLOADS_API = 'https://api.npmjs.org/downloads/point'
const OSV_QUERY_API = 'https://api.osv.dev/v1/query'
const BUNDLEPHOBIA_API = 'https://bundlephobia.com/api/size'
const NPMS_API = 'https://api.npms.io/v2/package'

const SafeStringSchema = v.pipe(v.string(), v.regex(/^[^<>"&]*$/, 'Invalid characters'))

const QUERY_SCHEMA = v.object({
  color: v.optional(SafeStringSchema),
  name: v.optional(v.string()),
  labelColor: v.optional(SafeStringSchema),
  label: v.optional(SafeStringSchema),
})

const COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  orange: '#f97316',
  red: '#ef4444',
  cyan: '#06b6d4',
  slate: '#64748b',
  yellow: '#eab308',
  black: '#0a0a0a',
  white: '#ffffff',
}

const DEFAULT_CHAR_WIDTH = 7
const CHARS_WIDTH = {
  engines: 5.5,
}

function measureTextWidth(text: string, charWidth?: number): number {
  charWidth ??= DEFAULT_CHAR_WIDTH
  const paddingX = 8
  return Math.max(40, Math.round(text.length * charWidth) + paddingX * 2)
}

function formatBytes(bytes: number): string {
  if (!+bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${value} ${sizes[i]}`
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' }).format(
    num,
  )
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getLatestVersion(pkgData: globalThis.Packument): string | undefined {
  return pkgData['dist-tags']?.latest
}

async function fetchDownloads(
  packageName: string,
  period: 'last-day' | 'last-week' | 'last-month' | 'last-year',
): Promise<number> {
  try {
    const response = await fetch(`${NPM_DOWNLOADS_API}/${period}/${packageName}`)
    const data = await response.json()
    return data.downloads ?? 0
  } catch {
    return 0
  }
}

async function fetchNpmsScore(packageName: string) {
  try {
    const response = await fetch(`${NPMS_API}/${encodeURIComponent(packageName)}`)
    const data = await response.json()
    return data.score
  } catch {
    return null
  }
}

async function fetchVulnerabilities(packageName: string, version: string): Promise<number> {
  try {
    const response = await fetch(OSV_QUERY_API, {
      method: 'POST',
      body: JSON.stringify({
        version,
        package: { name: packageName, ecosystem: 'npm' },
      }),
    })
    const data = await response.json()
    return data.vulns?.length ?? 0
  } catch {
    return 0
  }
}

async function fetchInstallSize(packageName: string, version: string): Promise<number | null> {
  try {
    const response = await fetch(`${BUNDLEPHOBIA_API}?package=${packageName}@${version}`)
    const data = await response.json()
    return data.size ?? null
  } catch {
    return null
  }
}

const badgeStrategies = {
  'version': async (pkgData: globalThis.Packument, requestedVersion?: string) => {
    const value = requestedVersion ?? getLatestVersion(pkgData) ?? 'unknown'
    return { label: 'version', value, color: COLORS.blue }
  },

  'license': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const versionData = latest ? pkgData.versions?.[latest] : undefined
    const value = versionData?.license ?? 'unknown'
    return { label: 'license', value, color: COLORS.green }
  },

  'size': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const versionData = latest ? pkgData.versions?.[latest] : undefined
    let bytes = versionData?.dist?.unpackedSize ?? 0
    if (latest) {
      const installSize = await fetchInstallSize(pkgData.name, latest)
      if (installSize !== null) bytes = installSize
    }
    return { label: 'install size', value: formatBytes(bytes), color: COLORS.purple }
  },

  'downloads': async (pkgData: globalThis.Packument) => {
    const count = await fetchDownloads(pkgData.name, 'last-month')
    return { label: 'downloads/mo', value: formatNumber(count), color: COLORS.orange }
  },

  'downloads-day': async (pkgData: globalThis.Packument) => {
    const count = await fetchDownloads(pkgData.name, 'last-day')
    return { label: 'downloads/day', value: formatNumber(count), color: COLORS.orange }
  },

  'downloads-week': async (pkgData: globalThis.Packument) => {
    const count = await fetchDownloads(pkgData.name, 'last-week')
    return { label: 'downloads/wk', value: formatNumber(count), color: COLORS.orange }
  },

  'downloads-month': async (pkgData: globalThis.Packument) => {
    const count = await fetchDownloads(pkgData.name, 'last-month')
    return { label: 'downloads/mo', value: formatNumber(count), color: COLORS.orange }
  },

  'downloads-year': async (pkgData: globalThis.Packument) => {
    const count = await fetchDownloads(pkgData.name, 'last-year')
    return { label: 'downloads/yr', value: formatNumber(count), color: COLORS.orange }
  },

  'vulnerabilities': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const count = latest ? await fetchVulnerabilities(pkgData.name, latest) : 0
    const isSafe = count === 0
    const color = isSafe ? COLORS.green : COLORS.red
    return { label: 'vulns', value: String(count), color }
  },

  'dependencies': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const versionData = latest ? pkgData.versions?.[latest] : undefined
    const count = Object.keys(versionData?.dependencies ?? {}).length
    return { label: 'dependencies', value: String(count), color: COLORS.cyan }
  },

  'created': async (pkgData: globalThis.Packument) => {
    const dateStr = pkgData.time?.created ?? pkgData.time?.modified
    return { label: 'created', value: formatDate(dateStr), color: COLORS.slate }
  },

  'updated': async (pkgData: globalThis.Packument) => {
    const dateStr = pkgData.time?.modified ?? pkgData.time?.created ?? new Date().toISOString()
    return { label: 'updated', value: formatDate(dateStr), color: COLORS.slate }
  },

  'engines': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const nodeVersion = (latest && pkgData.versions?.[latest]?.engines?.node) ?? '*'
    return { label: 'node', value: nodeVersion, color: COLORS.yellow }
  },

  'types': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const versionData = latest ? pkgData.versions?.[latest] : undefined
    const hasTypes = !!(versionData?.types || versionData?.typings)
    const value = hasTypes ? 'included' : 'missing'
    const color = hasTypes ? COLORS.blue : COLORS.slate
    return { label: 'types', value, color }
  },

  'maintainers': async (pkgData: globalThis.Packument) => {
    const count = pkgData.maintainers?.length ?? 0
    return { label: 'maintainers', value: String(count), color: COLORS.cyan }
  },

  'deprecated': async (pkgData: globalThis.Packument) => {
    const latest = getLatestVersion(pkgData)
    const isDeprecated = !!(latest && pkgData.versions?.[latest]?.deprecated)
    return {
      label: 'status',
      value: isDeprecated ? 'deprecated' : 'active',
      color: isDeprecated ? COLORS.red : COLORS.green,
    }
  },

  'quality': async (pkgData: globalThis.Packument) => {
    const score = await fetchNpmsScore(pkgData.name)
    const value = score ? `${Math.round(score.detail.quality * 100)}%` : 'unknown'
    return { label: 'quality', value, color: COLORS.purple }
  },

  'popularity': async (pkgData: globalThis.Packument) => {
    const score = await fetchNpmsScore(pkgData.name)
    const value = score ? `${Math.round(score.detail.popularity * 100)}%` : 'unknown'
    return { label: 'popularity', value, color: COLORS.cyan }
  },

  'maintenance': async (pkgData: globalThis.Packument) => {
    const score = await fetchNpmsScore(pkgData.name)
    const value = score ? `${Math.round(score.detail.maintenance * 100)}%` : 'unknown'
    return { label: 'maintenance', value, color: COLORS.yellow }
  },

  'score': async (pkgData: globalThis.Packument) => {
    const score = await fetchNpmsScore(pkgData.name)
    const value = score ? `${Math.round(score.final * 100)}%` : 'unknown'
    return { label: 'score', value, color: COLORS.blue }
  },
}

const BadgeTypeSchema = v.picklist(Object.keys(badgeStrategies) as [string, ...string[]])

export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)
    const typeParam = getRouterParam(event, 'type')
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    if (pkgParamSegments.length === 0) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package name is required.' })
    }

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version: requestedVersion } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      const queryParams = v.safeParse(QUERY_SCHEMA, query)
      const userColor = queryParams.success ? queryParams.output.color : undefined
      const labelColor = queryParams.success ? queryParams.output.labelColor : undefined
      const showName = queryParams.success && queryParams.output.name === 'true'
      const userLabel = queryParams.success ? queryParams.output.label : undefined

      const badgeTypeResult = v.safeParse(BadgeTypeSchema, typeParam)
      const strategyKey = badgeTypeResult.success ? badgeTypeResult.output : 'version'
      const strategy = badgeStrategies[strategyKey as keyof typeof badgeStrategies]

      assertValidPackageName(packageName)

      const pkgData = await fetchNpmPackage(packageName)
      const strategyResult = await strategy(pkgData, requestedVersion)

      const finalLabel = userLabel ? userLabel : showName ? packageName : strategyResult.label
      const finalValue = strategyResult.value

      const rawColor = userColor ?? strategyResult.color
      const finalColor = rawColor?.startsWith('#') ? rawColor : `#${rawColor}`

      const rawLabelColor = labelColor ?? '#0a0a0a'
      const finalLabelColor = rawLabelColor?.startsWith('#') ? rawLabelColor : `#${rawLabelColor}`

      const leftWidth = finalLabel.trim().length === 0 ? 0 : measureTextWidth(finalLabel)
      const rightWidth = measureTextWidth(
        finalValue,
        CHARS_WIDTH[strategyKey as keyof typeof CHARS_WIDTH],
      )
      const totalWidth = leftWidth + rightWidth
      const height = 20

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${finalLabel}: ${finalValue}">
          <clipPath id="r">
            <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
          </clipPath>
          <g clip-path="url(#r)">
            <rect width="${leftWidth}" height="${height}" fill="${finalLabelColor}"/>
            <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="${finalColor}"/>
          </g>
          <g text-anchor="middle" font-family="'Geist', system-ui, -apple-system, sans-serif" font-size="11">
            <text x="${leftWidth / 2}" y="14" fill="#ffffff">${finalLabel}</text>
            <text x="${leftWidth + rightWidth / 2}" y="14" fill="#ffffff">${finalValue}</text>
          </g>
        </svg>
      `.trim()

      setHeader(event, 'Content-Type', 'image/svg+xml')
      setHeader(
        event,
        'Cache-Control',
        `public, max-age=${CACHE_MAX_AGE_ONE_HOUR}, s-maxage=${CACHE_MAX_AGE_ONE_HOUR}`,
      )

      return svg
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_NPM_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const type = getRouterParam(event, 'type') ?? 'version'
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)
      return `badge:${type}:${pkg}:${hash(query)}`
    },
  },
)
