/**
 * Image proxy utilities for privacy-safe README image rendering.
 *
 * Resolves: https://github.com/npmx-dev/npmx.dev/issues/1138
 */

import { lookup } from 'node:dns/promises'
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
 * Check if a resolved IP address is in a private/reserved range.
 * Uses ipaddr.js for comprehensive IPv4, IPv6, and IPv4-mapped IPv6 range detection.
 */
function isPrivateIP(ip: string): boolean {
  const bare = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip
  if (!ipaddr.isValid(bare)) return false
  const addr = ipaddr.process(bare)
  return addr.range() !== 'unicast'
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
  if (isPrivateIP(hostname)) {
    return false
  }

  return true
}

/**
 * Resolve the hostname of a URL via DNS and validate that all resolved IPs are
 * public unicast addresses. This prevents DNS rebinding SSRF attacks where a
 * hostname passes the initial string-based check but resolves to a private IP.
 *
 * Returns true if the hostname resolves to a safe (unicast) IP.
 * Returns false if any resolved IP is private/reserved, or if resolution fails.
 */
export async function resolveAndValidateHost(url: string): Promise<boolean> {
  const parsed = URL.parse(url)
  if (!parsed) return false

  const hostname = parsed.hostname.toLowerCase()

  // If it's already an IP literal, skip DNS resolution (already validated by isAllowedImageUrl)
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
  if (ipaddr.isValid(bare)) {
    return !isPrivateIP(bare)
  }

  try {
    // Resolve with { all: true } to get every A/AAAA record. A hostname can
    // have multiple records; an attacker could mix a public IP with a private
    // one. If any resolved IP is private/reserved, reject the entire request.
    const results = await lookup(hostname, { all: true })
    if (results.length === 0) return false
    return results.every(result => !isPrivateIP(result.address))
  } catch {
    // DNS resolution failed — block the request
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
