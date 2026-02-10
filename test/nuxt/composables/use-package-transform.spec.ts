import { describe, expect, it } from 'vitest'
import type { Packument, PackageVersionInfo } from '#shared/types'
import { transformPackument } from '~/composables/npm/usePackage'
import { detectPublishSecurityDowngradeForVersion } from '~/utils/publish-security'

function createVersion(version: string, hasAttestations = false): Packument['versions'][string] {
  return {
    _id: `foo@${version}`,
    _npmVersion: '10.0.0',
    name: 'foo',
    version,
    dist: {
      shasum: version,
      tarball: `https://registry.npmjs.org/foo/-/foo-${version}.tgz`,
      signatures: [],
      ...(hasAttestations
        ? {
            attestations: {
              url: `https://example.test/${version}`,
              provenance: { predicateType: 'https://slsa.dev/provenance/v1' },
            },
          }
        : {}),
    },
  }
}

function createTrustedPublisherVersion(version: string) {
  return {
    ...createVersion(version, false),
    _npmUser: {
      name: 'github-actions',
      email: 'noreply@github.com',
      trustedPublisher: {
        id: 'github',
      },
    },
  }
}

function createTrustedPublisherWithAttestationsVersion(version: string) {
  return {
    ...createVersion(version, true),
    _npmUser: {
      name: 'github-actions',
      email: 'noreply@github.com',
      trustedPublisher: {
        id: 'github',
      },
    },
  }
}

function createPackument(
  versions: Packument['versions'],
  time: Packument['time'],
  latest: string,
): Packument {
  return {
    '_id': 'foo',
    '_rev': '1',
    'name': 'foo',
    'dist-tags': { latest },
    time,
    versions,
  }
}

function toVersionInfos(packument: ReturnType<typeof transformPackument>): PackageVersionInfo[] {
  return (
    packument.securityVersions ??
    Object.entries(packument.versions).map(([version, metadata]) => ({
      version,
      time: packument.time[version],
      hasProvenance: !!metadata.hasProvenance,
      trustLevel: metadata.trustLevel,
      deprecated: metadata.deprecated,
    }))
  )
}

describe('transformPackument', () => {
  it('includes requested old version and preserves provenance on it', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0', true),
        '1.0.1': createVersion('1.0.1'),
        '1.0.2': createVersion('1.0.2'),
        '1.0.3': createVersion('1.0.3'),
        '1.0.4': createVersion('1.0.4'),
        '1.0.5': createVersion('1.0.5'),
        '1.0.6': createVersion('1.0.6'),
        '1.0.7': createVersion('1.0.7'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-08T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
        '1.0.2': '2026-01-03T00:00:00.000Z',
        '1.0.3': '2026-01-04T00:00:00.000Z',
        '1.0.4': '2026-01-05T00:00:00.000Z',
        '1.0.5': '2026-01-06T00:00:00.000Z',
        '1.0.6': '2026-01-07T00:00:00.000Z',
        '1.0.7': '2026-01-08T00:00:00.000Z',
      },
      '1.0.7',
    )

    const transformed = transformPackument(packument, '1.0.0')

    expect(transformed.versions['1.0.0']?.hasProvenance).toBe(true)
    expect(transformed.versions['1.0.1']).toBeUndefined()
    expect(transformed.versions['1.0.2']).toBeUndefined()
    expect(transformed.securityVersions).toHaveLength(8)
  })

  it('omits securityVersions when all versions have the same trust level', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0'),
        '1.0.1': createVersion('1.0.1'),
        '1.0.2': createVersion('1.0.2'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-03T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
        '1.0.2': '2026-01-03T00:00:00.000Z',
      },
      '1.0.2',
    )

    const transformed = transformPackument(packument, '1.0.2')

    // All versions have trustLevel 'none', so no mixed trust — omit the array
    expect(transformed.securityVersions).toBeUndefined()
  })

  it('includes securityVersions when package has mixed trust levels', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0', true),
        '1.0.1': createVersion('1.0.1'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-02T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
      },
      '1.0.1',
    )

    const transformed = transformPackument(packument, '1.0.1')

    expect(transformed.securityVersions).toHaveLength(2)
  })

  it('works with downgrade detection for viewed version', () => {
    const packument = createPackument(
      {
        '1.0.0': createVersion('1.0.0', true),
        '1.0.1': createVersion('1.0.1'),
        '1.0.2': createVersion('1.0.2', true),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-03T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
        '1.0.2': '2026-01-03T00:00:00.000Z',
      },
      '1.0.2',
    )

    const transformed = transformPackument(packument, '1.0.1')
    const infos = toVersionInfos(transformed)

    expect(detectPublishSecurityDowngradeForVersion(infos, '1.0.2')).toBeNull()
    expect(detectPublishSecurityDowngradeForVersion(infos, '1.0.1')).toEqual({
      downgradedVersion: '1.0.1',
      downgradedPublishedAt: '2026-01-02T00:00:00.000Z',
      downgradedTrustLevel: 'none',
      trustedVersion: '1.0.0',
      trustedPublishedAt: '2026-01-01T00:00:00.000Z',
      trustedTrustLevel: 'provenance',
    })
  })

  it('treats trustedPublisher as trust evidence for downgrade checks', () => {
    const packument = createPackument(
      {
        '1.0.0': createTrustedPublisherVersion('1.0.0'),
        '1.0.1': createVersion('1.0.1'),
        '1.0.2': createVersion('1.0.2'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-03T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
        '1.0.2': '2026-01-03T00:00:00.000Z',
      },
      '1.0.2',
    )

    const transformed = transformPackument(packument, '1.0.1')
    const infos = toVersionInfos(transformed)

    expect(infos.find(v => v.version === '1.0.0')?.hasProvenance).toBe(true)
    expect(detectPublishSecurityDowngradeForVersion(infos, '1.0.1')?.trustedVersion).toBe('1.0.0')
  })

  it('prefers trustedPublisher trust level when both trustedPublisher and attestations exist', () => {
    const packument = createPackument(
      {
        '1.0.0': createTrustedPublisherWithAttestationsVersion('1.0.0'),
        '1.0.1': createTrustedPublisherVersion('1.0.1'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-02T00:00:00.000Z',
        '1.0.0': '2026-01-01T00:00:00.000Z',
        '1.0.1': '2026-01-02T00:00:00.000Z',
      },
      '1.0.1',
    )

    const transformed = transformPackument(packument, '1.0.1')

    expect(transformed.versions['1.0.0']?.trustLevel).toBe('trustedPublisher')
  })

  // https://github.com/npmx-dev/npmx.dev/issues/1292
  it('does not flag false downgrade when trusted publisher version also has attestations', () => {
    // Trusted publishing automatically generates provenance attestations,
    // so a version with both should be classified as trustedPublisher, not provenance.
    const packument = createPackument(
      {
        '7.0.0': createTrustedPublisherWithAttestationsVersion('7.0.0'),
        '7.0.1': createTrustedPublisherWithAttestationsVersion('7.0.1'),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-02T00:00:00.000Z',
        '7.0.0': '2026-01-01T00:00:00.000Z',
        '7.0.1': '2026-01-02T00:00:00.000Z',
      },
      '7.0.1',
    )

    const transformed = transformPackument(packument, '7.0.1')
    const infos = toVersionInfos(transformed)

    // Both versions should be trustedPublisher — no downgrade
    expect(infos.find(v => v.version === '7.0.0')?.trustLevel).toBe('trustedPublisher')
    expect(infos.find(v => v.version === '7.0.1')?.trustLevel).toBe('trustedPublisher')
    expect(detectPublishSecurityDowngradeForVersion(infos, '7.0.1')).toBeNull()
  })

  it('flags non-direct downgrade chain until trust is restored', () => {
    const packument = createPackument(
      {
        '2.1.0': createVersion('2.1.0', true),
        '2.1.1': createVersion('2.1.1'),
        '2.2.0': createVersion('2.2.0'),
        '2.3.0': createVersion('2.3.0'),
        '2.4.0': createVersion('2.4.0', true),
      },
      {
        'created': '2026-01-01T00:00:00.000Z',
        'modified': '2026-01-05T00:00:00.000Z',
        '2.1.0': '2026-01-01T00:00:00.000Z',
        '2.1.1': '2026-01-02T00:00:00.000Z',
        '2.2.0': '2026-01-03T00:00:00.000Z',
        '2.3.0': '2026-01-04T00:00:00.000Z',
        '2.4.0': '2026-01-05T00:00:00.000Z',
      },
      '2.4.0',
    )

    const transformed = transformPackument(packument, '2.3.0')
    const infos = toVersionInfos(transformed)

    expect(detectPublishSecurityDowngradeForVersion(infos, '2.1.1')?.trustedVersion).toBe('2.1.0')
    expect(detectPublishSecurityDowngradeForVersion(infos, '2.2.0')?.trustedVersion).toBe('2.1.0')
    expect(detectPublishSecurityDowngradeForVersion(infos, '2.3.0')?.trustedVersion).toBe('2.1.0')
    expect(detectPublishSecurityDowngradeForVersion(infos, '2.4.0')).toBeNull()
  })
})
