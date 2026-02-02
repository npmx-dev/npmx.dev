import * as v from 'valibot'
import { createError, getRouterParam, setHeader } from 'h3'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { fetchLatestVersionWithFallback } from '#server/utils/npm'
import { assertValidPackageName } from '#shared/utils/npm'
import { handleApiError } from '#server/utils/error-handler'

function measureTextWidth(text: string, charWidth = 6.2, paddingX = 6): number {
  return Math.max(40, Math.round(text.length * charWidth) + paddingX * 2)
}

export default defineBypassableCachedEventHandler(
  async event => {
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

      assertValidPackageName(packageName)

      const label = `./ ${packageName}`

      const value =
        requestedVersion ?? (await fetchLatestVersionWithFallback(packageName)) ?? 'unknown'

      const leftWidth = measureTextWidth(label)
      const rightWidth = measureTextWidth(value)
      const totalWidth = leftWidth + rightWidth
      const height = 20

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${value}">
          <clipPath id="r">
            <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
          </clipPath>
          <g clip-path="url(#r)">
            <rect width="${leftWidth}" height="${height}" fill="#0a0a0a"/>
            <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="#ffffff"/>
          </g>
          <g text-anchor="middle" font-family="'Geist', system-ui, -apple-system, sans-serif" font-size="11">
            <text x="${leftWidth / 2}" y="14" fill="#ffffff">${label}</text>
            <text x="${leftWidth + rightWidth / 2}" y="14" fill="#000000">${value}</text>
          </g>
        </svg>
      `.trim()

      setHeader(event, 'Content-Type', 'image/svg+xml')

      return svg
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to generate npm badge.',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    bypassKey: 'badge',
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `badge:version:${pkg}`
    },
  },
)
