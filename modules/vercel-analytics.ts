import process from 'node:process'
import { join } from 'node:path'
import { addTemplate, defineNuxtModule } from 'nuxt/kit'
import { withLeadingSlash } from 'ufo'

/**
 * Exposes the Web Analytics paths that Vercel provides at build time as `#vercel-analytics`.
 */
export default defineNuxtModule({
  meta: {
    name: 'vercel-analytics',
  },
  setup(_, nuxt) {
    addTemplate({
      filename: 'vercel-analytics.ts',
      write: true,
      getContents: () =>
        `export const vercelAnalytics: Partial<Record<'scriptSrc' | 'viewEndpoint' | 'eventEndpoint' | 'sessionEndpoint', string>> = ${JSON.stringify(getVercelAnalyticsConfig(process.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG))}`,
    })
    nuxt.options.alias['#vercel-analytics'] = join(nuxt.options.buildDir, 'vercel-analytics')
  },
})

export function getVercelAnalyticsConfig(clientConfig: string | undefined) {
  try {
    const analytics = JSON.parse(clientConfig || '{}').analytics ?? {}
    const config: Record<string, string> = {}
    for (const key of ['scriptSrc', 'viewEndpoint', 'eventEndpoint', 'sessionEndpoint']) {
      if (typeof analytics[key] === 'string' && analytics[key]) {
        config[key] = withLeadingSlash(analytics[key])
      }
    }
    return config
  } catch {
    return {}
  }
}
