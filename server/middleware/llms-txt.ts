import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { handleApiError } from '#server/utils/error-handler'
import { handleLlmsTxt, handleOrgLlmsTxt, generateRootLlmsTxt } from '#server/utils/llms-txt'

/**
 * Middleware to handle llms.txt / llms_full.txt routes that can't be served
 * by Nitro's file-based routing (versioned paths hit a radix3 limitation
 * where parameterized intermediate segments don't resolve literal children).
 *
 * Handles:
 * - /llms.txt (root — file-based route is blocked by canonical-redirects)
 * - /package/:name/v/:version/llms.txt
 * - /package/:name/v/:version/llms_full.txt
 * - /package/@:org/:name/v/:version/llms.txt
 * - /package/@:org/:name/v/:version/llms_full.txt
 * - /package/@:org/llms.txt (org listing)
 *
 * Non-versioned package routes are left to file-based handlers.
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
    setHeader(event, 'Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
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
      setHeader(event, 'Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
      return content
    } catch (error: unknown) {
      handleApiError(error, { statusCode: 502, message: 'Failed to generate org llms.txt.' })
    }
  }

  // Versioned paths — only handle if /v/ is present (non-versioned are handled by file routes)
  if (!inner.includes('/v/')) return

  let rawPackageName: string
  let rawVersion: string

  if (inner.startsWith('@')) {
    // Scoped: @org/name/v/version
    const match = inner.match(/^(@[^/]+\/[^/]+)\/v\/(.+)$/)
    if (!match) return
    rawPackageName = match[1]
    rawVersion = match[2]
  } else {
    // Unscoped: name/v/version
    const match = inner.match(/^([^/]+)\/v\/(.+)$/)
    if (!match) return
    rawPackageName = match[1]
    rawVersion = match[2]
  }

  try {
    const { packageName, version } = v.parse(PackageRouteParamsSchema, {
      packageName: rawPackageName,
      version: rawVersion,
    })

    const content = await handleLlmsTxt(packageName, version, { includeAgentFiles: full })
    setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
    setHeader(event, 'Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    return content
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: `Failed to generate ${full ? 'llms_full.txt' : 'llms.txt'}.`,
    })
  }
})
