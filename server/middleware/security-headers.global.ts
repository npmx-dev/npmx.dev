import { TRUSTED_IMAGE_DOMAINS } from '../utils/image-proxy'

/**
 * Set Content-Security-Policy and other security headers on HTML responses.
 *
 * Skips API routes and internal Nuxt/Vercel paths (see SKIP_PREFIXES).
 * Static assets from public/ are served by the CDN in production and don't
 * hit Nitro middleware.
 *
 * Current policy uses 'unsafe-inline' for scripts and styles because:
 * - Nuxt injects inline scripts for hydration and payload transfer
 * - Vue uses inline styles for :style bindings and scoped CSS
 */

const imgSrc = [
  "'self'",
  // README images may use data URIs
  'data:',
  // Trusted image domains loaded directly (not proxied).
  // All other README images go through /api/registry/image-proxy ('self').
  ...TRUSTED_IMAGE_DOMAINS.map(domain => `https://${domain}`),
].join(' ')

const connectSrc = [
  "'self'",
  'https://*.algolia.net', // Algolia npm-search client
].join(' ')

const frameSrc = [
  'https://bsky.app', // embedded Bluesky posts
  'https://pdsmoover.com', // PDS migration tool
].join(' ')

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

/** Paths that should not receive the global CSP header. */
const SKIP_PREFIXES = [
  '/api/', // API routes set their own headers (e.g. image proxy has its own CSP)
  '/_nuxt/', // Built JS/CSS chunks
  '/_v/', // Vercel analytics proxy
  '/_avatar/', // Gravatar proxy
  '/__og-image__/', // OG image generation
  '/__nuxt_error', // Nuxt error page (internal)
]

export default defineEventHandler(event => {
  const path = event.path.split('?')[0]!
  if (SKIP_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }

  setHeader(event, 'Content-Security-Policy', csp)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'X-Frame-Options', 'DENY')
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
})
