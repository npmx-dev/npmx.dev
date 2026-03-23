import { createError, getQuery, getRouterParam, sendRedirect } from 'h3'
import { assertValidPackageName } from '#shared/utils/npm'

export default defineEventHandler(async event => {
  const segments = getRouterParam(event, 'pkg')?.split('/') ?? []

  // Strip .png extension from the final segment (e.g. /api/card/nuxt.png)
  if (segments.length > 0) {
    const last = segments[segments.length - 1]!
    if (last.endsWith('.png')) segments[segments.length - 1] = last.slice(0, -4)
  }

  const packageName = segments.join('/')

  if (!packageName) {
    throw createError({ statusCode: 404, message: 'Package name is required.' })
  }

  assertValidPackageName(packageName)

  const query = getQuery(event)
  const theme = query.theme === 'light' ? 'light' : 'dark'
  const color = typeof query.color === 'string' ? `&color=${encodeURIComponent(query.color)}` : ''

  return sendRedirect(
    event,
    `/__og-image__/image/share-card/${packageName}/og.png?theme=${theme}${color}`,
    302,
  )
})
