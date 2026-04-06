import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type * as NpmApi from '~/utils/npm/api'
import VersionsPage from '~/pages/package/[[org]]/[name]/versions.vue'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Phase 2: full metadata (fired automatically after phase 1 completes)
const mockFetchAllPackageVersions = vi.fn()
vi.mock('~/utils/npm/api', async importOriginal => {
  const actual = await importOriginal<typeof NpmApi>()
  return {
    ...actual,
    fetchAllPackageVersions: (...args: unknown[]) => mockFetchAllPackageVersions(...args),
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock response payload matching the fast-npm-meta /versions/ API shape.
 */
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

/**
 * Next response to return from the fast-npm-meta fetch mock.
 * Set this before mounting the page.
 */
let nextFetchResponse: ReturnType<typeof makeVersionData> | null = null

const originalFetch = globalThis.fetch

function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.includes('npm.antfu.dev/versions/')) {
    const body = nextFetchResponse ?? { distTags: {}, versions: [], time: {} }
    return Promise.resolve(Response.json(body))
  }
  return originalFetch(input, init)
}

async function mountPage(route = '/package/test-package/versions') {
  return mountSuspended(VersionsPage, { route })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('package versions page', () => {
  beforeEach(() => {
    nextFetchResponse = null
    mockFetchAllPackageVersions.mockReset()
    globalThis.fetch = mockFetch as typeof globalThis.fetch
    mockFetchAllPackageVersions.mockResolvedValue([])
    clearNuxtData()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('basic rendering', () => {
    it('renders the package name in the header', async () => {
      nextFetchResponse = makeVersionData(['1.0.0'], { latest: '1.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('test-package'))
    })

    it('renders "Version History" section with total count', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('Version History')
        expect(component.text()).toContain('(2)')
      })
    })
  })

  describe('current tags section', () => {
    it('renders latest version in the featured card', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('latest')
        expect(component.text()).toContain('2.0.0')
      })
    })

    it('renders non-latest dist-tags in compact list', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0', '1.0.0-beta.1'], {
        latest: '2.0.0',
        stable: '1.0.0',
        beta: '1.0.0-beta.1',
      })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('stable')
        expect(component.text()).toContain('beta')
      })
    })
  })

  describe('version history groups', () => {
    it('renders group headers for each major version', async () => {
      nextFetchResponse = makeVersionData(['2.1.0', '2.0.0', '1.0.0'], { latest: '2.1.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).toContain('1.x')
      })
    })

    it('groups 0.x versions by major.minor (not just major)', async () => {
      nextFetchResponse = makeVersionData(['0.10.1', '0.10.0', '0.9.0'], { latest: '0.10.1' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('0.10.x')
        expect(component.text()).toContain('0.9.x')
      })
    })
  })

  describe('group expand / collapse', () => {
    it('expands a group and shows version rows on click', async () => {
      nextFetchResponse = makeVersionData(['1.1.0', '1.0.0'], { latest: '1.1.0' })
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

    it('fetches full metadata automatically after phase 1 completes, exactly once', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T00:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-10T00:00:00.000Z', hasProvenance: false },
      ])

      await mountPage()

      await vi.waitFor(() => expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1))
    })
  })

  describe('version filter', () => {
    it('filters groups by substring match', async () => {
      // Use versions where the filter string "1.0" is unique to the 1.x group
      nextFetchResponse = makeVersionData(['3.0.0', '2.0.0', '1.0.0'], { latest: '3.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).toContain('2.x')
        expect(component.text()).toContain('3.x')
      })

      const input = component.find('input[autocomplete="off"]')
      await input.setValue('1.0')

      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).not.toContain('2.x')
        expect(component.text()).not.toContain('3.x')
      })
    })
  })
})
