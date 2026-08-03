import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getOptionalClaimField,
  isStaleIsoDate,
  mapClaimTypeToPlatform,
  mapKeytraceVerificationStatus,
  mapPlatformToClaimType,
} from '../../server/utils/keytrace'

function createClaim(
  options: {
    verified?: boolean
    error?: string
    status?: string
    lastVerifiedAt?: string
  } = {},
) {
  const { status, lastVerifiedAt, ...result } = options

  return {
    verified: false,
    claim: {
      ...(status ? { status } : {}),
      ...(lastVerifiedAt ? { lastVerifiedAt } : {}),
    },
    ...result,
  } as never
}

afterEach(() => {
  vi.useRealTimers()
})

describe('keytrace utilities', () => {
  it('maps platform and claim-type aliases', () => {
    expect(mapPlatformToClaimType('mastodon')).toBe('activitypub')
    expect(mapPlatformToClaimType('bluesky')).toBe('bsky')
    expect(mapPlatformToClaimType('unknown')).toBe('unknown')

    expect(mapClaimTypeToPlatform('activitypub')).toBe('mastodon')
    expect(mapClaimTypeToPlatform('bsky')).toBe('bluesky')
    expect(mapClaimTypeToPlatform('unknown')).toBe('unknown')
  })

  it('returns only optional string fields from claim records', () => {
    const claim = createClaim({
      status: 'verified',
      lastVerifiedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(getOptionalClaimField(claim, 'status')).toBe('verified')
    expect(getOptionalClaimField(claim, 'lastVerifiedAt')).toBe('2026-01-01T00:00:00.000Z')
    expect(getOptionalClaimField(claim, 'missing')).toBeUndefined()
  })

  it('uses a strict 30-day stale threshold and ignores invalid dates', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))

    expect(isStaleIsoDate('2026-01-02T00:00:00.000Z')).toBe(false)
    expect(isStaleIsoDate('2026-01-01T23:59:59.999Z')).toBe(true)
    expect(isStaleIsoDate(undefined)).toBe(false)
    expect(isStaleIsoDate('not-a-date')).toBe(false)
  })

  it('maps failed and retracted claims to failed', () => {
    expect(mapKeytraceVerificationStatus(createClaim({ status: 'failed', verified: true }))).toBe(
      'failed',
    )
    expect(
      mapKeytraceVerificationStatus(createClaim({ status: 'retracted', verified: true })),
    ).toBe('failed')
  })

  it('maps current and stale verified claims', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T00:00:00.000Z'))

    expect(
      mapKeytraceVerificationStatus(
        createClaim({
          status: 'verified',
          lastVerifiedAt: '2026-01-15T00:00:00.000Z',
        }),
      ),
    ).toBe('verified')
    expect(
      mapKeytraceVerificationStatus(
        createClaim({
          verified: true,
          lastVerifiedAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    ).toBe('stale')
  })

  it('maps errors to failed and other claims to unverified', () => {
    expect(mapKeytraceVerificationStatus(createClaim({ error: 'Invalid signature' }))).toBe(
      'failed',
    )
    expect(mapKeytraceVerificationStatus(createClaim())).toBe('unverified')
  })
})
