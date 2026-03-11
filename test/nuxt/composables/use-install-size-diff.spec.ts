import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlimPackument, InstallSizeResult } from '#shared/types'

function createPackage(
  name: string,
  time: Record<string, string>,
  distTags: Record<string, string> = {},
): SlimPackument {
  return {
    '_id': name,
    'name': name,
    'dist-tags': { latest: '1.0.0', ...distTags },
    'time': { created: '2020-01-01', ...time },
    'versions': {},
    'requestedVersion': null,
  } as SlimPackument
}

function createInstallSize(
  name: string,
  overrides: Partial<InstallSizeResult> = {},
): InstallSizeResult {
  return {
    package: name,
    version: '1.0.0',
    selfSize: 1000,
    totalSize: 5000,
    dependencyCount: 3,
    dependencies: [],
    ...overrides,
  }
}

describe('useInstallSizeDiff', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(createInstallSize('test'))
    vi.stubGlobal('$fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('comparisonVersion', () => {
    it('selects the semver-previous stable version', () => {
      const pkg = createPackage('test', {
        '1.0.0': '2020-01-01',
        '1.1.0': '2021-01-01',
        '1.2.0': '2022-01-01',
      })

      const { comparisonVersion } = useInstallSizeDiff('test', '1.2.0', pkg, null)
      expect(comparisonVersion.value).toBe('1.1.0')
    })

    it('returns null for the first ever stable version', () => {
      const pkg = createPackage('test', { '1.0.0': '2020-01-01' })

      const { comparisonVersion } = useInstallSizeDiff('test', '1.0.0', pkg, null)
      expect(comparisonVersion.value).toBeNull()
    })

    it('skips prerelease versions when finding previous stable', () => {
      const pkg = createPackage('test', {
        '1.0.0': '2020-01-01',
        '2.0.0-beta.1': '2021-01-01',
        '2.0.0-beta.2': '2021-06-01',
        '2.0.0': '2022-01-01',
      })

      const { comparisonVersion } = useInstallSizeDiff('test', '2.0.0', pkg, null)
      expect(comparisonVersion.value).toBe('1.0.0')
    })

    it('uses the latest dist-tag for a prerelease version', () => {
      const pkg = createPackage(
        'test',
        { '1.0.0': '2020-01-01', '2.0.0-beta.1': '2021-01-01' },
        { latest: '1.0.0', next: '2.0.0-beta.1' },
      )

      const { comparisonVersion } = useInstallSizeDiff('test', '2.0.0-beta.1', pkg, null)
      expect(comparisonVersion.value).toBe('1.0.0')
    })

    it('returns null when the prerelease version is already latest', () => {
      const pkg = createPackage(
        'test',
        { '2.0.0-beta.1': '2021-01-01' },
        { latest: '2.0.0-beta.1' },
      )

      const { comparisonVersion } = useInstallSizeDiff('test', '2.0.0-beta.1', pkg, null)
      expect(comparisonVersion.value).toBeNull()
    })

    it('returns null for a prerelease when there is no latest tag', () => {
      const pkg = createPackage('test', { '2.0.0-beta.1': '2021-01-01' }, {})
      pkg['dist-tags'] = {}

      const { comparisonVersion } = useInstallSizeDiff('test', '2.0.0-beta.1', pkg, null)
      expect(comparisonVersion.value).toBeNull()
    })
  })

  describe('diff', () => {
    it('returns null when no comparison version exists', () => {
      const pkg = createPackage('test', { '1.0.0': '2020-01-01' })
      const current = createInstallSize('test', { version: '1.0.0' })

      const { diff } = useInstallSizeDiff('test', '1.0.0', pkg, current)

      expect(diff.value).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('returns null when both thresholds are not met', async () => {
      const pkg = createPackage('pkg-no-threshold', {
        '1.0.0': '2020-01-01',
        '1.1.0': '2021-01-01',
      })
      const current = createInstallSize('pkg-no-threshold', {
        version: '1.1.0',
        totalSize: 5100,
        dependencyCount: 4,
      })
      fetchSpy.mockResolvedValue(
        createInstallSize('pkg-no-threshold', {
          version: '1.0.0',
          totalSize: 5000,
          dependencyCount: 3,
        }),
      )

      const { diff } = useInstallSizeDiff('pkg-no-threshold', '1.1.0', pkg, current)

      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      expect(diff.value).toBeNull()
    })

    it('sets sizeThresholdExceeded when size increased by more than 25%', async () => {
      const pkg = createPackage('pkg-size-only', { '1.0.0': '2020-01-01', '1.1.0': '2021-01-01' })
      const current = createInstallSize('pkg-size-only', {
        version: '1.1.0',
        totalSize: 7000,
        dependencyCount: 4,
      })
      fetchSpy.mockResolvedValue(
        createInstallSize('pkg-size-only', {
          version: '1.0.0',
          totalSize: 5000,
          dependencyCount: 3,
        }),
      )

      const { diff } = useInstallSizeDiff('pkg-size-only', '1.1.0', pkg, current)

      await vi.waitFor(() => expect(diff.value).not.toBeNull())
      expect(diff.value).toEqual({
        comparisonVersion: '1.0.0',
        sizeRatio: 0.4,
        sizeIncrease: 2000,
        currentSize: 7000,
        previousSize: 5000,
        depDiff: 1,
        currentDeps: 4,
        previousDeps: 3,
        sizeThresholdExceeded: true,
        depThresholdExceeded: false,
      })
    })

    it('sets depThresholdExceeded when more than 5 dependencies were added', async () => {
      const pkg = createPackage('pkg-deps-only', { '1.0.0': '2020-01-01', '1.1.0': '2021-01-01' })
      const current = createInstallSize('pkg-deps-only', {
        version: '1.1.0',
        totalSize: 5100,
        dependencyCount: 10,
      })
      fetchSpy.mockResolvedValue(
        createInstallSize('pkg-deps-only', {
          version: '1.0.0',
          totalSize: 5000,
          dependencyCount: 3,
        }),
      )

      const { diff } = useInstallSizeDiff('pkg-deps-only', '1.1.0', pkg, current)

      await vi.waitFor(() => expect(diff.value).not.toBeNull())
      expect(diff.value).toEqual({
        comparisonVersion: '1.0.0',
        sizeRatio: 0.02,
        sizeIncrease: 100,
        currentSize: 5100,
        previousSize: 5000,
        depDiff: 7,
        currentDeps: 10,
        previousDeps: 3,
        sizeThresholdExceeded: false,
        depThresholdExceeded: true,
      })
    })

    it('returns correct diff values', async () => {
      const pkg = createPackage('pkg-both', { '1.0.0': '2020-01-01', '1.1.0': '2021-01-01' })
      const current = createInstallSize('pkg-both', {
        version: '1.1.0',
        totalSize: 10000,
        dependencyCount: 15,
      })
      fetchSpy.mockResolvedValue(
        createInstallSize('pkg-both', { version: '1.0.0', totalSize: 5000, dependencyCount: 5 }),
      )

      const { diff } = useInstallSizeDiff('pkg-both', '1.1.0', pkg, current)

      await vi.waitFor(() => expect(diff.value).not.toBeNull())
      expect(diff.value).toEqual({
        comparisonVersion: '1.0.0',
        sizeRatio: 1, // 100% increase
        sizeIncrease: 5000,
        currentSize: 10000,
        previousSize: 5000,
        depDiff: 10,
        currentDeps: 15,
        previousDeps: 5,
        sizeThresholdExceeded: true,
        depThresholdExceeded: true,
      })
    })
  })

  describe('fetch behavior', () => {
    it('calls the correct API endpoint for the comparison version', async () => {
      const pkg = createPackage('my-pkg', { '1.0.0': '2020-01-01', '1.1.0': '2021-01-01' })
      const current = createInstallSize('my-pkg', { version: '1.1.0', totalSize: 7000 })
      fetchSpy.mockResolvedValue(createInstallSize('my-pkg', { version: '1.0.0', totalSize: 5000 }))

      useInstallSizeDiff('my-pkg', '1.1.0', pkg, current)

      await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalled())
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/registry/install-size/my-pkg/v/1.0.0')
    })

    it('does not fetch when there is no comparison version', () => {
      const pkg = createPackage('my-pkg', { '1.0.0': '2020-01-01' })

      useInstallSizeDiff('my-pkg', '1.0.0', pkg, null)

      expect(fetchSpy).not.toHaveBeenCalled()
    })
  })
})
