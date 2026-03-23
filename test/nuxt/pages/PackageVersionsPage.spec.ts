import type * as NpmApi from '~/utils/npm/api'
import type * as FastNpmMeta from 'fast-npm-meta'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VersionsPage from '~/pages/package/[[org]]/[name]/versions.vue'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Phase 1: lightweight version summary (page load)
const mockGetVersions = vi.fn()
vi.mock('fast-npm-meta', async importOriginal => {
  const actual = await importOriginal<typeof FastNpmMeta>()
  return {
    ...actual,
    getVersions: (...args: unknown[]) => mockGetVersions(...args),
  }
})

// Phase 2: full metadata (loaded on first group expand)
const mockFetchAllPackageVersions = vi.fn()
vi.mock('~/utils/npm/api', async importOriginal => {
  const actual = await importOriginal<typeof NpmApi>()
  return {
    ...actual,
    fetchAllPackageVersions: (...args: unknown[]) => mockFetchAllPackageVersions(...args),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeVersionData(
  versions: string[],
  distTags: Record<string, string>,
  time?: Record<string, string>,
) {
  return {
    distTags,
    versions,
    time:
      time ??
      Object.fromEntries(versions.map((v, i) => [v, new Date(2024, 0, 15 - i).toISOString()])),
  }
}

async function mountPage(route = '/package/test-package/versions') {
  return mountSuspended(VersionsPage, { route })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('package versions page', () => {
  beforeEach(() => {
    mockGetVersions.mockReset()
    mockFetchAllPackageVersions.mockReset()
    clearNuxtData()
  })

  describe('basic rendering', () => {
    it('renders the package name in the header', async () => {
      mockGetVersions.mockResolvedValue(makeVersionData(['1.0.0'], { latest: '1.0.0' }))
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('test-package'))
    })

    it('renders "Version History" section with total count', async () => {
      mockGetVersions.mockResolvedValue(makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' }))
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('Version History')
        expect(component.text()).toContain('(2)')
      })
    })
  })

  describe('current tags section', () => {
    it('renders latest version in the featured card', async () => {
      mockGetVersions.mockResolvedValue(makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' }))
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('latest')
        expect(component.text()).toContain('2.0.0')
      })
    })

    it('renders non-latest dist-tags in compact list', async () => {
      mockGetVersions.mockResolvedValue(
        makeVersionData(['2.0.0', '1.0.0', '1.0.0-beta.1'], {
          latest: '2.0.0',
          stable: '1.0.0',
          beta: '1.0.0-beta.1',
        }),
      )
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('stable')
        expect(component.text()).toContain('beta')
      })
    })
  })

  describe('version history groups', () => {
    it('renders group headers for each major version', async () => {
      mockGetVersions.mockResolvedValue(
        makeVersionData(['2.1.0', '2.0.0', '1.0.0'], { latest: '2.1.0' }),
      )
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).toContain('1.x')
      })
    })

    it('groups 0.x versions by major.minor (not just major)', async () => {
      mockGetVersions.mockResolvedValue(
        makeVersionData(['0.10.1', '0.10.0', '0.9.0'], { latest: '0.10.1' }),
      )
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('0.10.x')
        expect(component.text()).toContain('0.9.x')
      })
    })
  })

  describe('group expand / collapse', () => {
    it('expands a group and shows version rows on click', async () => {
      mockGetVersions.mockResolvedValue(makeVersionData(['1.1.0', '1.0.0'], { latest: '1.1.0' }))
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '1.1.0', time: '2024-01-15T00:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-10T00:00:00.000Z', hasProvenance: false },
      ])
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('1.x'))

      const header = component.find('button[aria-expanded="false"]')
      await header.trigger('click')

      await vi.waitFor(() => {
        expect(header.attributes('aria-expanded')).toBe('true')
      })
    })

    it('only fetches full metadata once across multiple group expansions', async () => {
      mockGetVersions.mockResolvedValue(makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' }))
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T00:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-10T00:00:00.000Z', hasProvenance: false },
      ])
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.findAll('button[aria-expanded="false"]').length).toBeGreaterThanOrEqual(2)
      })

      const [first, second] = component.findAll('button[aria-expanded="false"]')
      await first!.trigger('click')
      await vi.waitFor(() => expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1))

      await second!.trigger('click')
      expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)
    })
  })

  describe('version filter', () => {
    it('filters groups by substring match', async () => {
      // Use versions where the filter string "1.0" is unique to the 1.x group
      mockGetVersions.mockResolvedValue(
        makeVersionData(['3.0.0', '2.0.0', '1.0.0'], { latest: '3.0.0' }),
      )
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).toContain('2.x')
        expect(component.text()).toContain('3.x')
      })

      const input = component.find('input[placeholder="Filter versions\u2026"]')
      await input.setValue('1.0')

      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).not.toContain('2.x')
        expect(component.text()).not.toContain('3.x')
      })
    })
  })
})
