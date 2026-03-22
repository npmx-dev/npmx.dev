import { defineNuxtModule } from 'nuxt/kit'
import { ALL_KNOWN_GIT_API_ORIGINS } from '#shared/utils/git-providers'
import { TRUSTED_IMAGE_DOMAINS } from '#server/utils/image-proxy'

/**
 * Adds Content-Security-Policy and other security headers to all pages.
 *
 * CSP is delivered via a <meta http-equiv> tag in <head>, so it naturally
 * only applies to HTML pages (not API routes). The remaining security
 * headers are set via a catch-all route rule.
 *
 * Note: frame-ancestors is not supported in meta-tag CSP, but
 * X-Frame-Options: DENY (set via route rule) provides equivalent protection.
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
      // Local CLI connector (npmx CLI communicates via localhost)
      'http://127.0.0.1:*',
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
      `base-uri 'self'`,
      `form-action 'self'`,
      `object-src 'none'`,
      `manifest-src 'self'`,
      'upgrade-insecure-requests',
    ].join('; ')

    // CSP via <meta> tag — only present in HTML pages, not API responses.
    nuxt.options.app.head ??= {}
    const head = nuxt.options.app.head as { meta?: Array<Record<string, string>> }
    head.meta ??= []
    head.meta.push({
      'http-equiv': 'Content-Security-Policy',
      'content': csp,
    })

    // Other security headers via route rules (fine on all responses).
    nuxt.options.routeRules ??= {}
    const wildCardRules = nuxt.options.routeRules['/**']
    nuxt.options.routeRules['/**'] = {
      ...wildCardRules,
      headers: {
        ...wildCardRules?.headers,
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    }
  },
})
