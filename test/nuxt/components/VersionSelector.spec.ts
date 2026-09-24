import { describe, expect, it, vi, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { PackageVersionInfo } from '#shared/types/npm-registry'
import VersionSelector from '~/components/VersionSelector.vue'

// Mock the fetchAllPackageVersions function
const mockFetchAllPackageVersions = vi.fn()
vi.mock('~/utils/npm/api', () => ({
  fetchAllPackageVersions: (...args: unknown[]) => mockFetchAllPackageVersions(...args),
}))

// Mock navigateTo
const mockNavigateTo = vi.fn()
vi.stubGlobal('navigateTo', mockNavigateTo)

const defaultProps = {
  packageName: 'test-package',
  currentVersion: '1.0.0',
  versions: { '1.0.0': {} },
  distTags: { latest: '1.0.0' },
  urlPattern: '/package-docs/test-package/v/{version}',
}

type VersionSelectorWrapper = Awaited<ReturnType<typeof mountSuspended>>

/** The trigger button that toggles the version popover. */
function getTrigger(component: VersionSelectorWrapper) {
  return component.find('[data-testid="version-selector-button"]')
}

/** The native popover element that holds the version groups. */
function getPopover(component: VersionSelectorWrapper) {
  return component.find('[popover="auto"]')
}

/** Open the popover by activating its trigger. */
function openPopover(component: VersionSelectorWrapper) {
  return getTrigger(component).trigger('click')
}

/** Returns true when the native popover is open (in the top layer). */
function isPopoverOpen(component: VersionSelectorWrapper): boolean {
  const popover = getPopover(component)
  return popover.exists() && popover.element.matches(':popover-open')
}

describe('VersionSelector', () => {
  beforeEach(() => {
    mockFetchAllPackageVersions.mockReset()
    mockNavigateTo.mockReset()
  })

  describe('basic rendering', () => {
    it('renders the current version in the button', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      const button = getTrigger(component)
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('1.0.0')
    })

    it('shows "latest" badge when current version is latest', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '2.0.0': {} },
          distTags: { latest: '2.0.0' },
        },
      })
      expect(component.text()).toContain('latest')
    })

    it('does not show "latest" badge in trigger when current version is not latest', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
      })
      const button = getTrigger(component)
      expect(button.text()).not.toContain('latest')
    })

    it('popover is not visible initially', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      expect(isPopoverOpen(component)).toBe(false)
    })
  })

  describe('popover behavior', () => {
    it('opens popover when trigger is clicked', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      expect(isPopoverOpen(component)).toBe(true)
      component.unmount()
    })

    it('closes popover when trigger is clicked again', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      const button = getTrigger(component)
      await button.trigger('click')
      expect(isPopoverOpen(component)).toBe(true)
      await button.trigger('click')
      expect(isPopoverOpen(component)).toBe(false)
      component.unmount()
    })

    it('shows version groups in popover', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)

      const popover = getPopover(component)
      expect(popover.text()).toContain('2.0.0')
      expect(popover.text()).toContain('1.0.0')
      component.unmount()
    })

    it('shows "View all X versions" link', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '1.0.0',
          versions: { '1.0.0': {}, '2.0.0': {}, '3.0.0': {} },
          distTags: { latest: '3.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      expect(component.text()).toContain('View all 3 versions')
      component.unmount()
    })
  })

  describe('keyboard navigation', () => {
    it('opens popover on ArrowDown when trigger is focused', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await getTrigger(component).trigger('keydown', { key: 'ArrowDown' })
      expect(isPopoverOpen(component)).toBe(true)
      component.unmount()
    })

    it('closes popover on Escape', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      expect(isPopoverOpen(component)).toBe(true)

      // A real (trusted) Escape triggers the browser's native popover
      // light-dismiss; a synthetic keydown event would not.
      await userEvent.keyboard('{Escape}')
      await vi.waitFor(() => expect(isPopoverOpen(component)).toBe(false))
      component.unmount()
    })

    it('navigates with arrow keys in popover', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      const popover = getPopover(component)
      await popover.trigger('keydown', { key: 'ArrowDown' })
      await popover.trigger('keydown', { key: 'ArrowUp' })
      expect(isPopoverOpen(component)).toBe(true)
      component.unmount()
    })

    it('navigates to Home and End', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '3.0.0',
          versions: { '1.0.0': {}, '2.0.0': {}, '3.0.0': {} },
          distTags: { latest: '3.0.0', beta: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      const popover = getPopover(component)
      await popover.trigger('keydown', { key: 'End' })
      await popover.trigger('keydown', { key: 'Home' })
      expect(isPopoverOpen(component)).toBe(true)
      component.unmount()
    })
  })

  describe('version selection', () => {
    it('generates correct URL from pattern', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
          urlPattern: '/package-code/test-package/v/{version}/src/index.ts',
        },
        attachTo: document.body,
      })
      await openPopover(component)

      const versionLink = component.findAll('a').find(a => a.text().includes('1.0.0'))
      expect(versionLink?.attributes('href')).toBe(
        '/package-code/test-package/v/1.0.0/src/index.ts',
      )
      component.unmount()
    })

    it('closes popover when clicking a version link', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)

      const versionLink = component.findAll('a').find(a => a.text().includes('1.0.0'))
      expect(versionLink?.exists()).toBe(true)
      await versionLink!.trigger('click')
      expect(isPopoverOpen(component)).toBe(false)
      component.unmount()
    })
  })

  describe('expand/collapse groups', () => {
    it('shows expand button for groups', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      expect(getPopover(component).find('button[aria-expanded]').exists()).toBe(true)
      component.unmount()
    })

    it('loads versions when expanding a group', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '1.0.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded="false"]').trigger('click')

      await vi.waitFor(() => {
        expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('test-package')
      })
      component.unmount()
    })

    it('collapses group when clicking expanded button', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '1.2.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '1.1.0',
          time: '2024-01-12T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '1.0.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '1.2.0',
          versions: { '1.2.0': {} },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded]').trigger('click')

      await vi.waitFor(() => expect(mockFetchAllPackageVersions).toHaveBeenCalled())
      await vi.waitFor(
        () =>
          expect(getPopover(component).find('button[aria-expanded="true"]').exists()).toBe(true),
        { timeout: 2000 },
      )

      await getPopover(component).find('button[aria-expanded="true"]').trigger('click')
      await vi.waitFor(
        () =>
          expect(getPopover(component).find('button[aria-expanded="false"]').exists()).toBe(true),
        { timeout: 2000 },
      )
      component.unmount()
    })

    it('toggles older version groups for a single-version tagged release', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '1.0.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: { ...defaultProps, versions: { '1.0.0': {}, '0.9.0': {} } },
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded="false"]').trigger('click')

      await vi.waitFor(() =>
        expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('test-package'),
      )
      await vi.waitFor(() => {
        expect(getPopover(component).text()).toContain('0.9')
        expect(getPopover(component).find('button[aria-expanded="true"]').exists()).toBe(true)
      })

      await getPopover(component).find('button[aria-expanded="true"]').trigger('click')
      await vi.waitFor(() => {
        expect(getPopover(component).text()).not.toContain('0.9')
        expect(getPopover(component).find('button[aria-expanded="false"]').exists()).toBe(true)
      })
      component.unmount()
    })

    it('does not reveal unrelated older groups when expanding a tagged row with nested versions', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '1.2.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '1.1.0',
          time: '2024-01-12T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '1.0.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.0',
          time: '2024-01-08T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '1.2.0',
          versions: { '1.2.0': {}, '1.1.0': {}, '1.0.0': {}, '0.9.0': {} },
          distTags: { latest: '1.2.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded="false"]').trigger('click')

      await vi.waitFor(() =>
        expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('test-package'),
      )
      await vi.waitFor(() => {
        const text = getPopover(component).text()
        expect(text).toContain('1.1.0')
        expect(text).toContain('1.0.0')
        expect(text).not.toContain('0.9')
      })

      await getPopover(component).find('button[aria-expanded="true"]').trigger('click')
      await vi.waitFor(() => {
        const text = getPopover(component).text()
        expect(text).not.toContain('1.1.0')
        expect(text).not.toContain('1.0.0')
        expect(text).not.toContain('0.9')
      })
      component.unmount()
    })

    it('resets showAllGroups when dist-tags props change after loading', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '1.0.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: { ...defaultProps, versions: { '1.0.0': {}, '0.9.0': {} } },
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded="false"]').trigger('click')

      await vi.waitFor(() => expect(getPopover(component).text()).toContain('0.9'))

      await component.setProps({ distTags: { latest: '1.0.0' } })
      await vi.waitFor(() => expect(getPopover(component).text()).not.toContain('0.9'))
      component.unmount()
    })

    it('ignores expand clicks while a group is already loading', async () => {
      let finishLoad: (value: PackageVersionInfo[]) => void
      const loadPromise = new Promise<PackageVersionInfo[]>(resolve => {
        finishLoad = resolve
      })
      mockFetchAllPackageVersions.mockReturnValue(loadPromise)

      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      const expandButton = getPopover(component).find('button[aria-expanded]')
      await expandButton.trigger('click')
      await expandButton.trigger('click')

      expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)

      finishLoad!([
        {
          version: '1.0.0',
          time: '2024-01-15T12:00:00.000Z',
          trustStatus: {
            provenance: false,
            trustedPublisher: false,
            stagedPublish: false,
          },
        },
      ])
      component.unmount()
    })
  })

  describe('0.x version grouping', () => {
    it('groups 0.x versions by minor version, not major', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '0.10.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.10.1',
          time: '2024-01-16T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '0.9.3',
          time: '2024-01-12T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '0.10.1',
          versions: { '0.10.1': {} },
          distTags: { latest: '0.10.1' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded]').trigger('click')

      await vi.waitFor(() => expect(mockFetchAllPackageVersions).toHaveBeenCalled())
      await vi.waitFor(
        () => {
          const text = component.text()
          expect(text).toContain('0.10')
          expect(text).toContain('0.10.0')
          expect(text).not.toContain('0.9')
        },
        { timeout: 2000 },
      )
      component.unmount()
    })
  })

  describe('dist-tag display', () => {
    it('displays multiple tags for same version', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          distTags: { latest: '1.0.0', stable: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      const popover = getPopover(component)
      expect(popover.text()).toContain('latest')
      expect(popover.text()).toContain('stable')
      component.unmount()
    })

    it('shows "latest" tag with special styling', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      const latestTags = component.findAll('span').filter(s => s.text() === 'latest')
      expect(latestTags.length).toBeGreaterThan(0)
      expect(latestTags.some(t => t.classes().some(c => c.includes('badge-accent')))).toBe(true)
      component.unmount()
    })
  })

  describe('loading states', () => {
    it('shows loading spinner when fetching versions', async () => {
      const { promise, resolve } = Promise.withResolvers<unknown[]>()
      mockFetchAllPackageVersions.mockReturnValue(promise)

      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded]').trigger('click')

      await vi.waitFor(() => {
        expect(component.find('.i-svg-spinners\\:ring-resize').exists()).toBe(true)
      })
      resolve([])
      component.unmount()
    })
  })

  describe('accessibility', () => {
    it('trigger button has popovertarget wired to the popover id', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      const button = getTrigger(component)
      const popover = getPopover(component)
      expect(button.attributes('popovertarget')).toBe(popover.attributes('id'))
    })

    it('popover has an accessible aria-label', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      expect(getPopover(component).attributes('aria-label')).toBeTruthy()
    })

    it('component is wrapped in a nav with an aria-label', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      expect(component.find('nav[aria-label]').exists()).toBe(true)
    })

    it('current version link has aria-current="page"', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      const currentLink = component.find('a[aria-current="page"]')
      expect(currentLink.exists()).toBe(true)
      expect(currentLink.text()).toContain('1.0.0')
      component.unmount()
    })

    it('non-current version links do not have aria-current', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      await openPopover(component)
      const oldLink = component.findAll('a[href]').find(a => a.text().includes('1.0.0'))
      expect(oldLink?.attributes('aria-current')).toBeUndefined()
      component.unmount()
    })

    it('expand buttons have aria-expanded and aria-controls', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      const expandButton = getPopover(component).find('button[aria-expanded]')
      expect(expandButton.exists()).toBe(true)
      expect(['true', 'false']).toContain(expandButton.attributes('aria-expanded'))
      expect(expandButton.attributes('aria-controls')).toBeTruthy()
      component.unmount()
    })

    it('expand buttons have a descriptive aria-label', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      const expandButton = getPopover(component).find('button[aria-label]')
      expect(expandButton.exists()).toBe(true)
      expect(expandButton.attributes('aria-label')).toBeTruthy()
      component.unmount()
    })

    it('decorative icons have aria-hidden', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
      })
      expect(component.findAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    })
  })

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockFetchAllPackageVersions.mockRejectedValue(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const component = await mountSuspended(VersionSelector, {
        props: defaultProps,
        attachTo: document.body,
      })
      await openPopover(component)
      await getPopover(component).find('button[aria-expanded]').trigger('click')

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load versions:', expect.any(Error))
      })
      consoleSpy.mockRestore()
      component.unmount()
    })
  })

  describe('caching behavior', () => {
    it('only fetches versions once when expanding multiple groups', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        {
          version: '2.0.0',
          time: '2024-01-15T12:00:00.000Z',
          hasProvenance: false,
        },
        {
          version: '1.0.0',
          time: '2024-01-10T12:00:00.000Z',
          hasProvenance: false,
        },
      ])

      const component = await mountSuspended(VersionSelector, {
        props: {
          ...defaultProps,
          currentVersion: '2.0.0',
          versions: { '1.0.0': {}, '2.0.0': {} },
          distTags: { latest: '2.0.0', old: '1.0.0' },
        },
        attachTo: document.body,
      })
      const button = getTrigger(component)
      await button.trigger('click')

      const expandButtons = getPopover(component).findAll('button[aria-expanded="false"]')
      if (expandButtons[0]) await expandButtons[0].trigger('click')
      await vi.waitFor(() => expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1))

      await button.trigger('click')
      await button.trigger('click')

      const updatedButtons = getPopover(component).findAll('button[aria-expanded="false"]')
      if (updatedButtons[0]) await updatedButtons[0].trigger('click')
      expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)
      component.unmount()
    })
  })
})
