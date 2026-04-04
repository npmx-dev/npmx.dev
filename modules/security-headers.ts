import { defineNuxtModule, useNuxt } from 'nuxt/kit'
import { BLUESKY_API } from '#shared/utils/constants'
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
  setup() {
    const nuxt = useNuxt()
    const devtools = nuxt.options.devtools

    const isDevtoolsRuntime =
      nuxt.options.dev &&
      devtools !== false &&
      (devtools == null || typeof devtools !== 'object' || devtools.enabled !== false) &&
      !process.env.TEST

    // These assets are embedded directly on blog pages and should not affect image-proxy trust.
    const cspOnlyImgOrigins = ['https://api.star-history.com', 'https://cdn.bsky.app']
    const imgSrc = [
      "'self'",
      'data:',
      ...TRUSTED_IMAGE_DOMAINS.map(domain => `https://${domain}`),
      ...cspOnlyImgOrigins,
    ].join(' ')

    const connectSrc = [
      "'self'",
      'https://*.algolia.net',
      'https://registry.npmjs.org',
      'https://api.npmjs.org',
      'https://npm.antfu.dev',
      BLUESKY_API,
      ...ALL_KNOWN_GIT_API_ORIGINS,
      // Local CLI connector (npmx CLI communicates via localhost)
      'http://127.0.0.1:*',
      // Devtools runtime (Vue Devtools, Nuxt Devtools, etc) — only in dev mode with devtools enabled
      ...(isDevtoolsRuntime ? ['ws://localhost:*'] : []),
    ].join(' ')

    const frameSrc = [
      'https://bsky.app',
      'https://pdsmoover.com',
      ...(isDevtoolsRuntime ? ["'self'"] : []),
    ].join(' ')

    const securityHeaders = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    }

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
        ...securityHeaders,
      },
    }

    if (!isDevtoolsRuntime) return

    const devtoolsRule = nuxt.options.routeRules['/__nuxt_devtools__/**']
    nuxt.options.routeRules['/__nuxt_devtools__/**'] = {
      ...devtoolsRule,
      headers: {
        ...wildCardRules?.headers,
        ...securityHeaders,
        ...devtoolsRule?.headers,
        'X-Frame-Options': 'SAMEORIGIN',
      },
    }
  },
})
