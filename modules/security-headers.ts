import { defineNuxtModule } from 'nuxt/kit'
import { ALL_KNOWN_GIT_API_ORIGINS } from '#shared/utils/git-providers'
import { TRUSTED_IMAGE_DOMAINS } from '#server/utils/image-proxy'

/**
 * Adds Content-Security-Policy and security headers to all HTML responses
 * via Nitro route rules. This covers both SSR/ISR pages and prerendered
 * pages (which are served as static files on Vercel and don't hit the server).
 *
 * API routes opt out via `false` to disable the inherited headers.
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

    nuxt.options.routeRules ??= {}
    nuxt.options.routeRules['/**'] = {
      ...nuxt.options.routeRules['/**'],
      headers,
    }
    // Disable page-specific headers on API routes — CSP doesn't apply to JSON.
    nuxt.options.routeRules['/api/**'] = {
      ...nuxt.options.routeRules['/api/**'],
      headers: false,
    }
  },
})
