import { describe, expect, it } from 'vitest'
import type { OsvAffected, OsvVulnerability } from '#shared/types/dependency-analysis'
import { isExcludedByLastKnownAffectedRange } from '#server/utils/osv'

function vuln(...affected: Array<Omit<OsvAffected, 'package'>>): OsvVulnerability {
  return {
    id: 'GHSA-test',
    modified: '2026-01-01',
    affected: affected.map(entry =>
      Object.assign({ package: { ecosystem: 'npm', name: 'nuxt' } }, entry),
    ),
  }
}

function openRange(introduced: string, upperBound?: string): Omit<OsvAffected, 'package'> {
  return {
    ranges: [{ type: 'ECOSYSTEM', events: [{ introduced }] }],
    ...(upperBound && { database_specific: { last_known_affected_version_range: upperBound } }),
  }
}

const GHSA_VJH5_4X84_XRQP = vuln(
  { ranges: [{ type: 'ECOSYSTEM', events: [{ introduced: '4.0.0' }, { fixed: '4.6.2' }] }] },
  openRange('3.0.0', '< 4.0.0'),
)

describe('isExcludedByLastKnownAffectedRange', () => {
  it.each([
    ['4.6.3', true],
    ['4.6.2', true],
    ['4.6.1', false],
    ['4.0.0-rc.1', false],
    ['3.21.0', false],
  ])('handles an unpatched range bounded by database_specific (%s)', (version, expected) => {
    expect(isExcludedByLastKnownAffectedRange(GHSA_VJH5_4X84_XRQP, 'nuxt', version)).toBe(expected)
  })

  it('keeps open-ended ranges without an upper bound', () => {
    expect(isExcludedByLastKnownAffectedRange(vuln(openRange('3.0.0')), 'nuxt', '9.0.0')).toBe(
      false,
    )
  })

  it('keeps matches when the upper bound cannot be parsed', () => {
    const advisory = vuln(openRange('3.0.0', 'not a range'))
    expect(isExcludedByLastKnownAffectedRange(advisory, 'nuxt', '9.0.0')).toBe(false)
  })

  it('keeps versions listed explicitly', () => {
    const advisory = vuln({ ...openRange('3.0.0', '< 4.0.0'), versions: ['4.1.0'] })
    expect(isExcludedByLastKnownAffectedRange(advisory, 'nuxt', '4.1.0')).toBe(false)
  })

  it('treats last_affected as an inclusive bound', () => {
    const advisory = vuln(
      { ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { last_affected: '2.0.0' }] }] },
      openRange('1.0.0', '< 2.0.0'),
    )
    expect(isExcludedByLastKnownAffectedRange(advisory, 'nuxt', '2.0.0')).toBe(false)
  })

  it('ignores affected entries for other packages', () => {
    const advisory: OsvVulnerability = {
      id: 'GHSA-test',
      modified: '2026-01-01',
      affected: [
        { package: { ecosystem: 'npm', name: 'other' }, ...openRange('3.0.0', '< 4.0.0') },
      ],
    }
    expect(isExcludedByLastKnownAffectedRange(advisory, 'nuxt', '4.6.3')).toBe(false)
  })
})
