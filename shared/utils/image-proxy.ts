/**
 * Image proxy utilities for privacy-safe README image rendering.
 *
 * Resolves: https://github.com/npmx-dev/npmx.dev/issues/1138
 */

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
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    return TRUSTED_IMAGE_DOMAINS.some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  } catch {
    return false
  }
}

/**
 * Validate that a URL is a valid HTTP(S) image URL suitable for proxying.
 */
export function isAllowedImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow HTTP and HTTPS protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    // Block localhost / private IPs to prevent SSRF
    const hostname = parsed.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('172.') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
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

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return url
    }
  } catch {
    // Not an absolute URL, return as-is (relative URLs are fine)
    return url
  }

  // Trusted domains don't need proxying
  if (isTrustedImageDomain(url)) {
    return url
  }

  // Proxy through our server endpoint
  return `/api/registry/image-proxy?url=${encodeURIComponent(url)}`
}
