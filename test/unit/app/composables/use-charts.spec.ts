import { describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/npm/api', () => ({
  fetchNpmDownloadsRange: vi.fn(),
}))

import { getNpmPackageCreationDate } from '~/composables/useCharts'

describe('getNpmPackageCreationDate', () => {
  it('returns created date from packument time', () => {
    const result = getNpmPackageCreationDate({
      time: {
        'created': '2020-01-15T10:00:00.000Z',
        'modified': '2025-01-01T00:00:00.000Z',
        '1.0.0': '2020-01-15T10:00:00.000Z',
      },
    })

    expect(result).toBe('2020-01-15T10:00:00.000Z')
  })

  it('returns earliest version date when created is missing', () => {
    const result = getNpmPackageCreationDate({
      time: {
        'modified': '2025-01-01T00:00:00.000Z',
        '1.0.0': '2020-06-01T00:00:00.000Z',
        '2.0.0': '2021-01-01T00:00:00.000Z',
      },
    })

    expect(result).toBe('2020-06-01T00:00:00.000Z')
  })

  it('returns null when time is missing', () => {
    expect(getNpmPackageCreationDate({})).toBeNull()
  })
})
