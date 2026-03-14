import { defineNuxtModule } from 'nuxt/kit'
import { ALL_KNOWN_GIT_API_ORIGINS } from '#shared/utils/git-providers'
import { TRUSTED_IMAGE_DOMAINS } from '#server/utils/image-proxy'

/**
 * Adds Content-Security-Policy and security headers to all HTML responses
 * via a Nitro route rule. This covers both SSR/ISR pages and prerendered
 * pages (which don't run server middleware).
 *
 * Current policy uses 'unsafe-inline' for scripts and styles because:
 * - Nuxt injects inline scripts for hydration and payload transfer
 * - Vue uses inline styles for :style bindings and scoped CSS
 */
export default defineNuxtModule({
  meta: { name: 'security-headers' },
  setup(_, nuxt) {
    const imgSrc = [
      "'self'",
      'data:',
      ...TRUSTED_IMAGE_DOMAINS.map(domain => `https://${domain}`),
    ].join(' ')

    const connectSrc = [
      "'self'",
      'https://*.algolia.net',
      'https://registry.npmjs.org',
      'https://api.npmjs.org',
      'https://npm.antfu.dev',
      ...ALL_KNOWN_GIT_API_ORIGINS,
    ].join(' ')

    const frameSrc = ['https://bsky.app', 'https://pdsmoover.com'].join(' ')

    const csp = [
      `default-src 'none'`,
      `script-src 'self' 'unsafe-inline'`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src ${imgSrc}`,
      `font-src 'self'`,
      `connect-src ${connectSrc}`,
      `frame-src ${frameSrc}`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `object-src 'none'`,
      `manifest-src 'self'`,
      'upgrade-insecure-requests',
    ].join('; ')

    const headers = {
      'Content-Security-Policy': csp,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }

    // Apply to all page routes via a catch-all rule.
    // API routes are excluded — CSP doesn't make sense for JSON responses.
    nuxt.options.routeRules ??= {}
    nuxt.options.routeRules['/**'] = {
      ...nuxt.options.routeRules['/**'],
      headers,
    }
    nuxt.options.routeRules['/api/**'] = {
      ...nuxt.options.routeRules['/api/**'],
      headers: {
        'X-Content-Type-Options': 'nosniff',
      },
    }
  },
})
