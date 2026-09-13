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

      // stable is a non-prerelease tag — visible by default
      await vi.waitFor(() => expect(component.text()).toContain('stable'))

      // beta points to a prerelease version — hidden by default, revealed via "Show all"
      expect(component.text()).not.toContain('beta')
      const showAllButton = component.findAll('button').find(b => b.text().includes('Show all'))
      expect(showAllButton).toBeDefined()
      await showAllButton!.trigger('click')

      await vi.waitFor(() => expect(component.text()).toContain('beta'))
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

    it('filters groups by semver range', async () => {
      nextFetchResponse = makeVersionData(['3.0.0', '2.1.0', '2.0.0', '1.0.0'], {
        latest: '3.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('3.x'))

      const input = component.find('input[autocomplete="off"]')
      await input.setValue('>=2.0.0 <3.0.0')

      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).not.toContain('1.x')
        expect(component.text()).not.toContain('3.x')
      })
    })

    it('shows no-match message when filter matches nothing', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('2.x'))

      const input = component.find('input[autocomplete="off"]')
      await input.setValue('9.9.9')

      await vi.waitFor(() => {
        expect(component.text()).not.toContain('1.x')
        expect(component.text()).not.toContain('2.x')
        // no-match status message rendered
        expect(component.find('[role="status"]').exists()).toBe(true)
      })
    })

    it('shows error indicator for an invalid semver range', async () => {
      nextFetchResponse = makeVersionData(['1.0.0'], { latest: '1.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('1.x'))

      const input = component.find('input[autocomplete="off"]')
      await input.setValue('not-a-range!!!')

      await vi.waitFor(() => {
        expect(input.attributes('aria-invalid')).toBe('true')
      })
    })

    it('clearing the filter restores all groups', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).toContain('2.x')
      })

      const input = component.find('input[autocomplete="off"]')
      await input.setValue('1.0')
      await vi.waitFor(() => expect(component.text()).not.toContain('2.x'))

      await input.setValue('')
      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        expect(component.text()).toContain('2.x')
      })
    })
  })

  describe('filter popover', () => {
    it('opens and closes on toggle button click', async () => {
      nextFetchResponse = makeVersionData(['1.0.0'], { latest: '1.0.0' })
      const component = await mountPage()
      await vi.waitFor(() =>
        expect(component.find('button[aria-haspopup="dialog"]').exists()).toBe(true),
      )

      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      expect(toggleBtn.attributes('aria-expanded')).toBe('false')

      await toggleBtn.trigger('click')
      expect(toggleBtn.attributes('aria-expanded')).toBe('true')
      expect(component.find('[role="dialog"]').exists()).toBe(true)

      await toggleBtn.trigger('click')
      expect(toggleBtn.attributes('aria-expanded')).toBe('false')
      expect(component.find('[role="dialog"]').exists()).toBe(false)
    })

    it('closes when Escape is pressed', async () => {
      nextFetchResponse = makeVersionData(['1.0.0'], { latest: '1.0.0' })
      const component = await mountPage()
      await vi.waitFor(() =>
        expect(component.find('button[aria-haspopup="dialog"]').exists()).toBe(true),
      )

      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      await toggleBtn.trigger('click')
      expect(toggleBtn.attributes('aria-expanded')).toBe('true')

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await vi.waitFor(() => expect(toggleBtn.attributes('aria-expanded')).toBe('false'))
    })

    it('shows a badge counting active filters', async () => {
      nextFetchResponse = makeVersionData(['1.0.0'], { latest: '1.0.0' })
      const component = await mountPage()
      await vi.waitFor(() =>
        expect(component.find('button[aria-haspopup="dialog"]').exists()).toBe(true),
      )

      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      expect(toggleBtn.text()).toBe('') // no badge when no filters active

      await toggleBtn.trigger('click')
      const checkboxes = component.find('[role="dialog"]').findAll('input[type="checkbox"]')

      await checkboxes[0]!.setValue(true) // enable show prereleases
      await vi.waitFor(() => expect(toggleBtn.text()).toBe('1'))

      await checkboxes[1]!.setValue(true) // enable show deprecated
      await vi.waitFor(() => expect(toggleBtn.text()).toBe('2'))

      await checkboxes[0]!.setValue(false) // disable show prereleases
      await vi.waitFor(() => expect(toggleBtn.text()).toBe('1'))
    })
  })

  describe('show prereleases toggle', () => {
    it('hides prerelease-only version groups by default', async () => {
      // 1.0.0-alpha.1 is the only version in 1.x — group is invisible until toggled
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0-alpha.1'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).not.toContain('1.x')
      })
    })

    it('reveals prerelease version groups when the toggle is enabled', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0-alpha.1'], { latest: '2.0.0' })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('2.x'))

      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      await toggleBtn.trigger('click')
      const checkboxes = component.find('[role="dialog"]').findAll('input[type="checkbox"]')
      await checkboxes[0]!.setValue(true) // showPrereleases

      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).toContain('1.x')
      })
    })
  })

  describe('show deprecated toggle', () => {
    it('hides deprecated-only version groups by default once metadata loads', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', hasProvenance: false },
        { version: '1.0.0', deprecated: 'Use 2.x instead', hasProvenance: false },
      ])
      const component = await mountPage()
      // fullVersionMap populates async; wait for the 1.x group to disappear
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).not.toContain('1.x')
      })
    })

    it('reveals deprecated version groups when the toggle is enabled', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], { latest: '2.0.0' })
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', hasProvenance: false },
        { version: '1.0.0', deprecated: 'Use 2.x instead', hasProvenance: false },
      ])
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).not.toContain('1.x')
      })

      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      await toggleBtn.trigger('click')
      const checkboxes = component.find('[role="dialog"]').findAll('input[type="checkbox"]')
      await checkboxes[1]!.setValue(true) // showDeprecated

      await vi.waitFor(() => expect(component.text()).toContain('1.x'))
    })

    it('marks a group header with a deprecated badge when all its versions are deprecated', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.1.0', '1.0.0'], { latest: '2.0.0' })
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', hasProvenance: false },
        { version: '1.1.0', deprecated: 'Use 2.x instead', hasProvenance: false },
        { version: '1.0.0', deprecated: 'Use 2.x instead', hasProvenance: false },
      ])
      const component = await mountPage()
      await vi.waitFor(() => {
        expect(component.text()).toContain('2.x')
        expect(component.text()).not.toContain('1.x')
      })

      // Enable show deprecated to reveal the all-deprecated 1.x group
      const toggleBtn = component.find('button[aria-haspopup="dialog"]')
      await toggleBtn.trigger('click')
      const checkboxes = component.find('[role="dialog"]').findAll('input[type="checkbox"]')
      await checkboxes[1]!.setValue(true)

      await vi.waitFor(() => {
        expect(component.text()).toContain('1.x')
        const groupHeader = component.findAll('button').find(b => b.text().includes('1.x'))
        expect(groupHeader?.text()).toContain('deprecated')
      })
    })
  })

  describe('sort tags buttons', () => {
    it('does not render sort controls with only one non-latest tag', async () => {
      nextFetchResponse = makeVersionData(['2.0.0', '1.0.0'], {
        latest: '2.0.0',
        stable: '1.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('stable'))

      expect(component.findAll('button[aria-pressed]')).toHaveLength(0)
    })

    it('renders sort controls when there are two or more non-latest tags', async () => {
      nextFetchResponse = makeVersionData(['3.0.0', '2.0.0', '1.0.0'], {
        latest: '3.0.0',
        next: '2.0.0',
        legacy: '1.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('next'))

      expect(component.findAll('button[aria-pressed]')).toHaveLength(2)
    })

    it('"Sort by tag" is active (aria-pressed) by default', async () => {
      nextFetchResponse = makeVersionData(['3.0.0', '2.0.0', '1.0.0'], {
        latest: '3.0.0',
        next: '2.0.0',
        legacy: '1.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('next'))

      const [sortByTagBtn, sortByDateBtn] = component.findAll('button[aria-pressed]')
      expect(sortByTagBtn!.attributes('aria-pressed')).toBe('true')
      expect(sortByDateBtn!.attributes('aria-pressed')).toBe('false')
    })

    it('clicking "Sort by date" activates date sort mode', async () => {
      nextFetchResponse = makeVersionData(['3.0.0', '2.0.0', '1.0.0'], {
        latest: '3.0.0',
        next: '2.0.0',
        legacy: '1.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('next'))

      const [sortByTagBtn, sortByDateBtn] = component.findAll('button[aria-pressed]')
      await sortByDateBtn!.trigger('click')

      await vi.waitFor(() => {
        expect(sortByDateBtn!.attributes('aria-pressed')).toBe('true')
        expect(sortByTagBtn!.attributes('aria-pressed')).toBe('false')
      })
    })

    it('clicking "Sort by date" twice toggles the sort direction', async () => {
      nextFetchResponse = makeVersionData(['3.0.0', '2.0.0', '1.0.0'], {
        latest: '3.0.0',
        next: '2.0.0',
        legacy: '1.0.0',
      })
      const component = await mountPage()
      await vi.waitFor(() => expect(component.text()).toContain('next'))

      const [, sortByDateBtn] = component.findAll('button[aria-pressed]')

      // First click: date sort, defaults to newest-first
      await sortByDateBtn!.trigger('click')
      await vi.waitFor(() =>
        expect(sortByDateBtn!.attributes('aria-label')).toContain('newest first'),
      )

      // Second click on the same active button: flips to oldest-first
      await sortByDateBtn!.trigger('click')
      await vi.waitFor(() =>
        expect(sortByDateBtn!.attributes('aria-label')).toContain('oldest first'),
      )
    })
  })
})
