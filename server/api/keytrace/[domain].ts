import { getClaimsForHandle, type ClaimVerificationResult } from '@keytrace/claims'
import type { KeytraceProofMethod, KeytraceResponse } from '#shared/types/keytrace'
import {
  getOptionalClaimField,
  mapKeytraceVerificationStatus,
  mapClaimTypeToPlatform,
} from '#server/utils/keytrace'
import { toProxiedImageUrl } from '#server/utils/image-proxy'
import { getSafeHttpUrl } from '#shared/utils/url'

function domainToDisplayName(domain: string): string {
  const firstSegment = domain.split('.')[0] || domain
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
}

function buildDefaultAvatarUrl(domain: string, imageProxySecret: string): string {
  return buildSeededAvatarUrl(domain, imageProxySecret)
}

function buildSeededAvatarUrl(seed: string, imageProxySecret: string): string {
  const rawFallbackAvatar = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}`
  return toProxiedImageUrl(rawFallbackAvatar, imageProxySecret)
}

function toProfileAvatarUrl(
  rawAvatarUrl: string | undefined,
  domain: string,
  imageProxySecret: string,
): string {
  const safeAvatarUrl = getSafeHttpUrl(rawAvatarUrl)
  if (!safeAvatarUrl) {
    return buildDefaultAvatarUrl(domain, imageProxySecret)
  }

  return toProxiedImageUrl(safeAvatarUrl, imageProxySecret)
}

function toAccountAvatarUrl(
  rawAvatarUrl: string | undefined,
  imageProxySecret: string,
  fallbackSeed: string,
): string {
  const safeAvatarUrl = getSafeHttpUrl(rawAvatarUrl)
  if (!safeAvatarUrl) {
    return buildSeededAvatarUrl(fallbackSeed, imageProxySecret)
  }

  return toProxiedImageUrl(safeAvatarUrl, imageProxySecret)
}

function buildFallbackProfile(domain: string, imageProxySecret: string): KeytraceResponse {
  return {
    profile: {
      name: `${domainToDisplayName(domain)} Developer`,
      avatar: buildDefaultAvatarUrl(domain, imageProxySecret),
      description: `No Keytrace claims found for ${domain}.`,
    },
    accounts: [],
  }
}

function buildServiceUnavailableProfile(
  domain: string,
  imageProxySecret: string,
): KeytraceResponse {
  return {
    profile: {
      name: `${domainToDisplayName(domain)} Developer`,
      avatar: buildDefaultAvatarUrl(domain, imageProxySecret),
      description: 'Keytrace is temporarily unavailable. Please try again shortly.',
    },
    accounts: [],
  }
}

const allowedProofMethods = new Set<KeytraceProofMethod>([
  'dns',
  'github',
  'npm',
  'mastodon',
  'bluesky',
  'pgp',
  'other',
])

function mapProofMethod(type: string): KeytraceProofMethod {
  const mappedType = mapClaimTypeToPlatform(type)
  return allowedProofMethods.has(mappedType as KeytraceProofMethod)
    ? (mappedType as KeytraceProofMethod)
    : 'other'
}

// Convert Keytrace claims to our account format
function mapClaimsToAccounts(
  claims: ClaimVerificationResult[],
  imageProxySecret: string,
): KeytraceResponse['accounts'] {
  return claims.map(claim => ({
    platform: mapClaimTypeToPlatform(claim.type),
    username: claim.identity.subject,
    displayName: claim.identity.displayName || claim.identity.subject,
    avatar: toAccountAvatarUrl(claim.identity.avatarUrl, imageProxySecret, claim.identity.subject),
    url: getSafeHttpUrl(claim.identity.profileUrl) || undefined,
    status: mapKeytraceVerificationStatus(claim),
    proofMethod: mapProofMethod(claim.type),
    addedAt: claim.claim.createdAt,
    lastCheckedAt:
      getOptionalClaimField(claim, 'lastVerifiedAt') ||
      claim.claim.retractedAt ||
      claim.claim.createdAt,
    failureReason: claim.error || undefined,
  }))
}

type KeytraceFetchResult =
  | { kind: 'success'; data: KeytraceResponse }
  | { kind: 'no-claims' }
  | { kind: 'error'; error: unknown }

// Fetch real Keytrace profile data
async function fetchKeytraceProfile(
  domain: string,
  imageProxySecret: string,
): Promise<KeytraceFetchResult> {
  try {
    const result = await getClaimsForHandle(domain)

    if (!result.claims || result.claims.length === 0) {
      return { kind: 'no-claims' }
    }

    // Build profile from first claim's identity (they all belong to the same DID)
    const firstClaim = result.claims[0]
    if (!firstClaim) {
      return { kind: 'no-claims' }
    }

    return {
      kind: 'success',
      data: {
        profile: {
          name: firstClaim.identity.displayName || domainToDisplayName(domain),
          avatar: toProfileAvatarUrl(firstClaim.identity.avatarUrl, domain, imageProxySecret),
          description: `Identity profile for ${domain}`,
        },
        accounts: mapClaimsToAccounts(result.claims, imageProxySecret),
      },
    }
  } catch (error) {
    console.error('Failed to fetch Keytrace profile:', error)
    return { kind: 'error', error }
  }
}

export default defineEventHandler(async event => {
  const { imageProxySecret } = useRuntimeConfig(event)
  const domain = getRouterParam(event, 'domain')?.trim().toLowerCase()
  if (!domain) {
    throw createError({
      statusCode: 400,
      message: 'Domain is required',
    })
  }

  // Try to fetch real Keytrace data
  const keytraceData = await fetchKeytraceProfile(domain, imageProxySecret)

  if (keytraceData.kind === 'success') {
    return keytraceData.data
  }

  if (keytraceData.kind === 'no-claims') {
    return buildFallbackProfile(domain, imageProxySecret)
  }

  // If Keytrace is unavailable and mock mode isn't allowed, return a neutral profile.
  return buildServiceUnavailableProfile(domain, imageProxySecret)
})
