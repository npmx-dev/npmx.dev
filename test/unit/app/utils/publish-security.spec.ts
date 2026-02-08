import { describe, expect, it } from 'vitest'
import { detectPublishSecurityDowngradeForVersion } from '../../../../app/utils/publish-security'

describe('detectPublishSecurityDowngradeForVersion', () => {
  const versions = [
    {
      version: '1.0.0',
      time: '2026-01-01T00:00:00.000Z',
      hasProvenance: true,
    },
    {
      version: '1.0.1',
      time: '2026-01-02T00:00:00.000Z',
      hasProvenance: false,
    },
    {
      version: '1.0.2',
      time: '2026-01-03T00:00:00.000Z',
      hasProvenance: true,
    },
  ]

  it('does not flag trusted viewed version (1.0.2)', () => {
    const result = detectPublishSecurityDowngradeForVersion(versions, '1.0.2')
    expect(result).toBeNull()
  })

  it('flags downgraded viewed version (1.0.1)', () => {
    const result = detectPublishSecurityDowngradeForVersion(versions, '1.0.1')
    expect(result).toEqual({
      downgradedVersion: '1.0.1',
      downgradedPublishedAt: '2026-01-02T00:00:00.000Z',
      trustedVersion: '1.0.0',
      trustedPublishedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('flags trust downgrade from provenance to trustedPublisher', () => {
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
        },
        {
          version: '1.0.1',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'trustedPublisher',
        },
      ],
      '1.0.1',
    )

    expect(result).toEqual({
      downgradedVersion: '1.0.1',
      downgradedPublishedAt: '2026-01-02T00:00:00.000Z',
      trustedVersion: '1.0.0',
      trustedPublishedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('flags ongoing downgraded versions until an upgrade happens', () => {
    const versions = [
      {
        version: '2.1.0',
        time: '2026-01-01T00:00:00.000Z',
        hasProvenance: true,
        trustLevel: 'provenance' as const,
      },
      {
        version: '2.1.1',
        time: '2026-01-02T00:00:00.000Z',
        hasProvenance: false,
        trustLevel: 'none' as const,
      },
      {
        version: '2.2.0',
        time: '2026-01-03T00:00:00.000Z',
        hasProvenance: false,
        trustLevel: 'none' as const,
      },
      {
        version: '2.3.0',
        time: '2026-01-04T00:00:00.000Z',
        hasProvenance: false,
        trustLevel: 'none' as const,
      },
      {
        version: '2.4.0',
        time: '2026-01-05T00:00:00.000Z',
        hasProvenance: true,
        trustLevel: 'provenance' as const,
      },
    ]

    expect(detectPublishSecurityDowngradeForVersion(versions, '2.1.1')?.trustedVersion).toBe(
      '2.1.0',
    )
    expect(detectPublishSecurityDowngradeForVersion(versions, '2.2.0')?.trustedVersion).toBe(
      '2.1.0',
    )
    expect(detectPublishSecurityDowngradeForVersion(versions, '2.3.0')?.trustedVersion).toBe(
      '2.1.0',
    )
    expect(detectPublishSecurityDowngradeForVersion(versions, '2.4.0')).toBeNull()
  })

  it('skips deprecated versions when selecting trustedVersion', () => {
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
        },
        {
          version: '1.0.1',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
          deprecated: 'Use 1.0.2 instead',
        },
        {
          version: '1.0.2',
          time: '2026-01-03T00:00:00.000Z',
          hasProvenance: false,
          trustLevel: 'none',
        },
      ],
      '1.0.2',
    )

    // Should recommend 1.0.0 (not 1.0.1 which is deprecated)
    expect(result?.trustedVersion).toBe('1.0.0')
  })

  it('returns null when all older trusted versions are deprecated', () => {
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
          deprecated: 'Deprecated',
        },
        {
          version: '1.0.1',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: false,
          trustLevel: 'none',
        },
      ],
      '1.0.1',
    )

    expect(result).toBeNull()
  })

  it('detects cross-major downgrade but does not recommend a version', () => {
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
        },
        {
          version: '2.0.0',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: false,
          trustLevel: 'none',
        },
      ],
      '2.0.0',
    )

    // Downgrade is detected (v1.0.0 was trusted, v2.0.0 is not)
    expect(result).not.toBeNull()
    expect(result?.downgradedVersion).toBe('2.0.0')
    // But no trustedVersion recommendation since v1.0.0 is a different major
    expect(result?.trustedVersion).toBeUndefined()
  })

  it('recommends same-major trusted version when cross-major exists', () => {
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
        },
        {
          version: '2.0.0',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'provenance',
        },
        {
          version: '2.1.0',
          time: '2026-01-03T00:00:00.000Z',
          hasProvenance: false,
          trustLevel: 'none',
        },
      ],
      '2.1.0',
    )

    // Should recommend 2.0.0 (same major), not 1.0.0
    expect(result?.trustedVersion).toBe('2.0.0')
  })

  it('uses trustedPublisher rank (not provenance) for hasProvenance fallback without trustLevel', () => {
    // When trustLevel is absent, hasProvenance: true should map to trustedPublisher rank,
    // not provenance rank. This means a version with only hasProvenance: true should NOT
    // be considered a downgrade from trustedPublisher.
    const result = detectPublishSecurityDowngradeForVersion(
      [
        {
          version: '1.0.0',
          time: '2026-01-01T00:00:00.000Z',
          hasProvenance: true,
          // no trustLevel — fallback path
        },
        {
          version: '1.0.1',
          time: '2026-01-02T00:00:00.000Z',
          hasProvenance: true,
          trustLevel: 'trustedPublisher',
        },
      ],
      '1.0.1',
    )

    // Both should be treated as trustedPublisher rank, so no downgrade
    expect(result).toBeNull()
  })
})
