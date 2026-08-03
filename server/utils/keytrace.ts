import type { ClaimVerificationResult } from '@keytrace/claims'
import type { KeytraceVerificationStatus } from '#shared/types/keytrace'

const STALE_THRESHOLD_DAYS = 30

const platformToClaimTypeMap: Record<string, string> = {
  github: 'github',
  dns: 'dns',
  mastodon: 'activitypub',
  bluesky: 'bsky',
  npm: 'npm',
  tangled: 'tangled',
  pgp: 'pgp',
  twitter: 'twitter',
  linkedin: 'linkedin',
  instagram: 'instagram',
  reddit: 'reddit',
  hackernews: 'hackernews',
  orcid: 'orcid',
  itchio: 'itchio',
  discord: 'discord',
  steam: 'steam',
}

const claimTypeToPlatformMap: Record<string, string> = {
  github: 'github',
  dns: 'dns',
  activitypub: 'mastodon',
  bsky: 'bluesky',
  npm: 'npm',
  tangled: 'tangled',
  pgp: 'pgp',
  twitter: 'twitter',
  linkedin: 'linkedin',
  instagram: 'instagram',
  reddit: 'reddit',
  hackernews: 'hackernews',
  orcid: 'orcid',
  itchio: 'itchio',
  discord: 'discord',
  steam: 'steam',
}

export function mapPlatformToClaimType(platform: string): string {
  return platformToClaimTypeMap[platform] || platform
}

export function mapClaimTypeToPlatform(type: string): string {
  return claimTypeToPlatformMap[type] || type
}

export function getOptionalClaimField(
  claim: ClaimVerificationResult,
  key: string,
): string | undefined {
  const rawClaim = claim.claim as unknown as Record<string, unknown>
  const value = rawClaim[key]
  return typeof value === 'string' ? value : undefined
}

export function isStaleIsoDate(isoDate: string | undefined): boolean {
  if (!isoDate) {
    return false
  }

  const timestamp = Date.parse(isoDate)
  if (Number.isNaN(timestamp)) {
    return false
  }

  return Date.now() - timestamp > STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
}

export function mapKeytraceVerificationStatus(
  claim: ClaimVerificationResult,
): KeytraceVerificationStatus {
  const rawStatus = getOptionalClaimField(claim, 'status')
  const lastVerifiedAt = getOptionalClaimField(claim, 'lastVerifiedAt')

  if (rawStatus === 'failed' || rawStatus === 'retracted') {
    return 'failed'
  }

  if (rawStatus === 'verified' || claim.verified) {
    return isStaleIsoDate(lastVerifiedAt) ? 'stale' : 'verified'
  }

  if (claim.error) {
    return 'failed'
  }

  return 'unverified'
}
