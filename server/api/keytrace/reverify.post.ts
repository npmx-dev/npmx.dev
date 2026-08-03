import { getClaimsForHandle, type ClaimVerificationResult } from '@keytrace/claims'
import type { KeytraceReverifyRequest, KeytraceReverifyResponse } from '#shared/types/keytrace'
import {
  getOptionalClaimField,
  mapPlatformToClaimType,
  mapKeytraceVerificationStatus,
} from '#server/utils/keytrace'

function mapReverifyStatus(claim: ClaimVerificationResult): KeytraceReverifyResponse['status'] {
  return mapKeytraceVerificationStatus(claim)
}

function getReverifyLastCheckedAt(claim: ClaimVerificationResult): string {
  return getOptionalClaimField(claim, 'lastVerifiedAt') || claim.claim.createdAt
}

function matchesAccount(
  claim: ClaimVerificationResult,
  claimType: string,
  username: string,
  url?: string,
): boolean {
  if (claim.type !== claimType) {
    return false
  }

  const normalizedSubject = claim.identity.subject.toLowerCase()
  const normalizedUsername = username.toLowerCase()
  if (normalizedSubject === normalizedUsername) {
    return true
  }

  const profileUrl = (claim.identity.profileUrl || '').toLowerCase()
  const normalizedUrl = (url || '').toLowerCase()
  if (normalizedUrl && profileUrl && profileUrl === normalizedUrl) {
    return true
  }

  return false
}

export default defineEventHandler(async event => {
  const body = await readBody<KeytraceReverifyRequest>(event)

  const identity = body?.identity?.trim().toLowerCase()
  const platform = body?.platform?.trim().toLowerCase()
  const username = body?.username?.trim()

  if (!identity || !platform || !username) {
    throw createError({
      statusCode: 400,
      message: 'identity, platform and username are required',
    })
  }

  try {
    const result = await getClaimsForHandle(identity)
    const claimType = mapPlatformToClaimType(platform)
    const matchedClaim = result.claims.find(claim =>
      matchesAccount(claim, claimType, username, body?.url),
    )

    if (!matchedClaim) {
      return {
        status: 'unverified',
        lastCheckedAt: new Date().toISOString(),
        failureReason: 'No matching Keytrace claim found for this account.',
      }
    }

    const response: KeytraceReverifyResponse = {
      status: mapReverifyStatus(matchedClaim),
      lastCheckedAt: getReverifyLastCheckedAt(matchedClaim),
      failureReason: matchedClaim.error || undefined,
    }

    if (matchedClaim.claim.retractedAt) {
      response.status = 'unverified'
      response.retractedAt = matchedClaim.claim.retractedAt
      response.failureReason = response.failureReason || 'Keytrace claim was retracted.'
    }

    return response
  } catch (error) {
    console.error('[keytrace] reverify failed', error)

    return {
      status: 'unverified',
      lastCheckedAt: new Date().toISOString(),
      failureReason: 'Keytrace is temporarily unavailable. Please try again shortly.',
    }
  }
})
