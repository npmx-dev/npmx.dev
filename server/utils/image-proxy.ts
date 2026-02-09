/**
 * Image proxy utilities for privacy-safe README image rendering.
 *
 * Resolves: https://github.com/npmx-dev/npmx.dev/issues/1138
 */

import ipaddr from 'ipaddr.js'

/** Trusted image domains that don't need proxying (first-party or well-known CDNs) */
const TRUSTED_IMAGE_DOMAINS = [
  // First-party
  'npmx.dev',

  // GitHub (already proxied by GitHub's own camo)
  'raw.githubusercontent.com',
  'github.com',
  'user-images.githubusercontent.com',
  'avatars.githubusercontent.com',
  'repository-images.githubusercontent.com',
  'github.githubassets.com',
  'objects.githubusercontent.com',

  // GitLab
  'gitlab.com',

  // CDNs commonly used in READMEs
  'cdn.jsdelivr.net',
  'unpkg.com',

  // Well-known badge/shield services
  'img.shields.io',
  'shields.io',
  'badge.fury.io',
  'badgen.net',
  'flat.badgen.net',
  'codecov.io',
  'coveralls.io',
  'david-dm.org',
  'snyk.io',
  'app.fossa.com',
  'api.codeclimate.com',
  'bundlephobia.com',
  'packagephobia.com',
]

/**
 * Check if a URL points to a trusted domain that doesn't need proxying.
 */
export function isTrustedImageDomain(url: string): boolean {
  const parsed = URL.parse(url)
  if (!parsed) return false

  const hostname = parsed.hostname.toLowerCase()
  return TRUSTED_IMAGE_DOMAINS.some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`),
  )
}

/**
 * Validate that a URL is a valid HTTP(S) image URL suitable for proxying.
 * Blocks private/reserved IPs (SSRF protection) using ipaddr.js for comprehensive
 * IPv4, IPv6, and IPv4-mapped IPv6 range detection.
 */
export function isAllowedImageUrl(url: string): boolean {
  const parsed = URL.parse(url)
  if (!parsed) return false

  // Only allow HTTP and HTTPS protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  // Block non-IP hostnames that resolve to internal services
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return false
  }

  // For IP addresses, use ipaddr.js to check against all reserved ranges
  // (loopback, private RFC 1918, link-local 169.254, IPv6 ULA fc00::/7, etc.)
  // ipaddr.process() also unwraps IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  if (ipaddr.isValid(bare)) {
    const addr = ipaddr.process(bare)
    if (addr.range() !== 'unicast') {
      return false
    }
  }

  return true
}

/**
 * Convert an external image URL to a proxied URL.
 * Trusted domains are returned as-is.
 * Returns the original URL for non-HTTP(S) URLs.
 */
export function toProxiedImageUrl(url: string): string {
  // Don't proxy data URIs, relative URLs, or anchor links
  if (!url || url.startsWith('#') || url.startsWith('data:')) {
    return url
  }

  // Protocol-relative URLs should be treated as HTTPS for proxying purposes
  if (url.startsWith('//')) {
    url = `https:${url}`
  }

  const parsed = URL.parse(url)
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return url
  }

  // Trusted domains don't need proxying
  if (isTrustedImageDomain(url)) {
    return url
  }

  // Proxy through our server endpoint
  return `/api/registry/image-proxy?url=${encodeURIComponent(url)}`
}
