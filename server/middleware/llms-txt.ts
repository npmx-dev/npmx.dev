import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { handleApiError } from '#server/utils/error-handler'
import { handleLlmsTxt, handleOrgLlmsTxt, generateRootLlmsTxt } from '#server/utils/llms-txt'

const CACHE_HEADER = 's-maxage=3600, stale-while-revalidate=86400'

/**
 * Middleware to handle ALL llms.txt / llms_full.txt routes.
 *
 * All llms.txt handling lives here rather than in file-based routes because
 * Vercel's ISR route rules with glob patterns (e.g. `/package/ ** /llms.txt`)
 * create catch-all serverless functions that interfere with Nitro's file-based
 * route resolution — scoped packages and versioned paths fail to match.
 *
 * Handles:
 * - /llms.txt (root discovery page)
 * - /package/@:org/llms.txt (org package listing)
 * - /package/:name/llms.txt (unscoped, latest)
 * - /package/:name/llms_full.txt (unscoped, latest, full)
 * - /package/@:org/:name/llms.txt (scoped, latest)
 * - /package/@:org/:name/llms_full.txt (scoped, latest, full)
 * - /package/:name/v/:version/llms.txt (unscoped, versioned)
 * - /package/:name/v/:version/llms_full.txt (unscoped, versioned, full)
 * - /package/@:org/:name/v/:version/llms.txt (scoped, versioned)
 * - /package/@:org/:name/v/:version/llms_full.txt (scoped, versioned, full)
 */
export default defineEventHandler(async event => {
  const path = event.path.split('?')[0]

  if (!path.endsWith('/llms.txt') && !path.endsWith('/llms_full.txt')) return

  const full = path.endsWith('/llms_full.txt')
  const suffix = full ? '/llms_full.txt' : '/llms.txt'

  // Root /llms.txt
  if (path === '/llms.txt') {
    const url = getRequestURL(event)
    const baseUrl = `${url.protocol}//${url.host}`
    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setHeader(event, 'Cache-Control', CACHE_HEADER)
    return generateRootLlmsTxt(baseUrl)
  }

  if (!path.startsWith('/package/')) return

  // Strip /package/ prefix and /llms[_full].txt suffix
  const inner = path.slice('/package/'.length, -suffix.length)

  // Org-level: /package/@org/llms.txt (inner = "@org")
  if (!full && inner.startsWith('@') && !inner.includes('/')) {
    const orgName = inner.slice(1)
    try {
      const url = getRequestURL(event)
      const baseUrl = `${url.protocol}//${url.host}`
      const content = await handleOrgLlmsTxt(orgName, baseUrl)
      setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
      setHeader(event, 'Cache-Control', CACHE_HEADER)
      return content
    } catch (error: unknown) {
      handleApiError(error, { statusCode: 502, message: 'Failed to generate org llms.txt.' })
    }
  }

  // Parse package name and optional version from inner path
  let rawPackageName: string
  let rawVersion: string | undefined

  if (inner.includes('/v/')) {
    // Versioned path
    if (inner.startsWith('@')) {
      const match = inner.match(/^(@[^/]+\/[^/]+)\/v\/(.+)$/)
      if (!match) return
      rawPackageName = match[1]
      rawVersion = match[2]
    } else {
      const match = inner.match(/^([^/]+)\/v\/(.+)$/)
      if (!match) return
      rawPackageName = match[1]
      rawVersion = match[2]
    }
  } else {
    // Latest version — inner is just the package name
    rawPackageName = inner
  }

  if (!rawPackageName) return

  try {
    const { packageName, version } = v.parse(PackageRouteParamsSchema, {
      packageName: rawPackageName,
      version: rawVersion,
    })

    const content = await handleLlmsTxt(packageName, version, { includeAgentFiles: full })
    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setHeader(event, 'Cache-Control', CACHE_HEADER)
    return content
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: `Failed to generate ${full ? 'llms_full.txt' : 'llms.txt'}.`,
    })
  }
})
