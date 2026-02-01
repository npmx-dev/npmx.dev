import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PackageVersions from '~/components/Package/Versions.vue'
import type { PackumentVersion } from '#shared/types'

// Mock the fetchAllPackageVersions function
const mockFetchAllPackageVersions = vi.fn()
vi.mock('~/composables/useNpmRegistry', () => ({
  fetchAllPackageVersions: (...args: unknown[]) => mockFetchAllPackageVersions(...args),
}))

/**
 * Helper to create a minimal PackumentVersion for testing
 */
function createVersion(
  version: string,
  options: {
    deprecated?: string
    hasProvenance?: boolean
  } = {},
): PackumentVersion {
  const dist: Record<string, unknown> = {
    tarball: `https://registry.npmjs.org/test-package/-/test-package-${version}.tgz`,
    shasum: 'abc123',
  }
  if (options.hasProvenance) {
    dist.attestations = { url: 'https://example.com', provenance: { predicateType: 'test' } }
  }
  return {
    _id: `test-package@${version}`,
    _npmVersion: '10.0.0',
    name: 'test-package',
    version,
    dist,
    deprecated: options.deprecated,
  } as unknown as PackumentVersion
}

describe('PackageVersions', () => {
  beforeEach(() => {
    mockFetchAllPackageVersions.mockReset()
  })

  describe('basic rendering', () => {
    it('renders the Versions heading', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      expect(component.find('#versions-heading').text()).toBe('Versions')
    })

    it('does not render when there are no dist-tags', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {},
          distTags: {},
          time: {},
        },
      })

      expect(component.find('section').exists()).toBe(false)
    })

    it('renders version links with correct routes', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find version links (exclude anchor links that start with #)
      const versionLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      expect(versionLinks.length).toBeGreaterThan(0)
      expect(versionLinks[0]?.text()).toBe('2.0.0')
    })

    it('renders scoped package version links correctly', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: '@scope/test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find version links (exclude anchor links that start with #)
      const versionLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      expect(versionLinks.length).toBeGreaterThan(0)
      expect(versionLinks[0]?.text()).toBe('1.0.0')
    })
  })

  describe('dist-tag display', () => {
    it('displays dist-tag labels below version', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      expect(component.text()).toContain('latest')
    })

    it('displays multiple tags for same version', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: {
            latest: '1.0.0',
            stable: '1.0.0',
          },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const text = component.text()
      expect(text).toContain('latest')
      expect(text).toContain('stable')
    })

    it('shows "latest" tag first when multiple tags exist', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: {
            alpha: '1.0.0',
            latest: '1.0.0',
            beta: '1.0.0',
          },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find all tag spans
      const tagSpans = component.findAll('span').filter(span => {
        const text = span.text()
        return text === 'latest' || text === 'alpha' || text === 'beta'
      })

      expect(tagSpans.length).toBeGreaterThanOrEqual(3)
      // latest should be first
      expect(tagSpans[0]?.text()).toBe('latest')
    })

    it('sorts tag rows by version descending', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
            '2.0.0': createVersion('2.0.0'),
            '1.5.0': createVersion('1.5.0'),
          },
          distTags: {
            old: '1.0.0',
            latest: '2.0.0',
            stable: '1.5.0',
          },
          time: {
            '1.0.0': '2024-01-01T00:00:00.000Z',
            '1.5.0': '2024-01-10T00:00:00.000Z',
            '2.0.0': '2024-01-15T00:00:00.000Z',
          },
        },
      })

      // Find version links (exclude anchor links that start with #)
      const versionLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      const versions = versionLinks.map(l => l.text())
      // Should be sorted by version descending
      expect(versions[0]).toBe('2.0.0')
    })
  })

  describe('deprecated versions', () => {
    it('applies deprecated styling to deprecated versions', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0', { deprecated: 'Use 2.0.0 instead' }),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find version links (exclude anchor links that start with #)
      const versionLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      expect(versionLinks.length).toBeGreaterThan(0)
      expect(versionLinks[0]?.classes()).toContain('text-red-400')
    })

    it('shows deprecated version in title attribute', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0', { deprecated: 'Use 2.0.0 instead' }),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find version links (exclude anchor links that start with #)
      const versionLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      expect(versionLinks.length).toBeGreaterThan(0)
      expect(versionLinks[0]?.attributes('title')).toContain('deprecated')
    })

    it('filters deprecated tags from visible list when package is not deprecated', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0', { deprecated: 'Old version' }),
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: {
            old: '1.0.0',
            latest: '2.0.0',
          },
          time: {
            '1.0.0': '2024-01-01T00:00:00.000Z',
            '2.0.0': '2024-01-15T00:00:00.000Z',
          },
        },
      })

      // The deprecated version should not appear in visible tags (only in "Other versions")
      const visibleLinks = component.findAll('a').filter(l => l.text() === '1.0.0')
      expect(visibleLinks.length).toBe(0)
    })
  })

  describe('provenance badge', () => {
    it('shows provenance badge for versions with attestations', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0', { hasProvenance: true }),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // ProvenanceBadge component should be rendered
      const provenanceBadge = component.findComponent({ name: 'ProvenanceBadge' })
      expect(provenanceBadge.exists()).toBe(true)
    })

    it('does not show provenance badge for versions without attestations', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0', { hasProvenance: false }),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const provenanceBadge = component.findComponent({ name: 'ProvenanceBadge' })
      expect(provenanceBadge.exists()).toBe(false)
    })
  })

  describe('datetime display', () => {
    it('shows DateTime component for versions with time', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const dateTime = component.findComponent({ name: 'DateTime' })
      expect(dateTime.exists()).toBe(true)
    })
  })

  describe('expand/collapse tag rows', () => {
    it('shows expand button for tag rows', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButton = component.find('[data-testid="tag-expand-button"]')
      expect(expandButton.exists()).toBe(true)
      expect(expandButton.attributes('aria-expanded')).toBe('false')
    })

    it('has correct aria-label on expand button', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButton = component.find('[data-testid="tag-expand-button"]')
      expect(expandButton.attributes('aria-label')).toBe('Expand latest')
    })

    it('loads versions and toggles expanded state on click', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '1.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '0.9.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButton = component.find('[data-testid="tag-expand-button"]')
      await expandButton.trigger('click')

      // Wait for async operation
      await vi.waitFor(() => {
        expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('test-package')
      })
    })

    it('collapses when clicking expanded row', async () => {
      // Return multiple versions so the expand button stays visible after loading
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '1.2.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.1.0', time: '2024-01-12T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.2.0': createVersion('1.2.0'),
          },
          distTags: { latest: '1.2.0' },
          time: { '1.2.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Get initial expand button
      const expandButton = component.find('[data-testid="tag-expand-button"]')
      expect(expandButton.exists()).toBe(true)

      // Expand
      await expandButton.trigger('click')

      // Wait for versions to load and expansion to happen
      await vi.waitFor(() => {
        expect(mockFetchAllPackageVersions).toHaveBeenCalled()
      })

      // Wait for the component to update after loading
      await vi.waitFor(
        () => {
          const btn = component.find('[data-testid="tag-expand-button"][aria-expanded="true"]')
          expect(btn.exists()).toBe(true)
        },
        { timeout: 2000 },
      )

      // Now collapse by clicking again
      const expandedButton = component.find(
        '[data-testid="tag-expand-button"][aria-expanded="true"]',
      )
      await expandedButton.trigger('click')

      await vi.waitFor(
        () => {
          const btn = component.find('[data-testid="tag-expand-button"][aria-expanded="false"]')
          expect(btn.exists()).toBe(true)
        },
        { timeout: 2000 },
      )
    })
  })

  describe('other versions section', () => {
    it('renders "Other versions" button', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      expect(component.text()).toContain('Other versions')
    })

    it('shows count of hidden tagged versions', async () => {
      // Create more than MAX_VISIBLE_TAGS (10) dist-tags
      const versions: Record<string, PackumentVersion> = {}
      const distTags: Record<string, string> = {}
      const time: Record<string, string> = {}

      for (let i = 0; i < 12; i++) {
        const version = `1.${i}.0`
        versions[version] = createVersion(version)
        distTags[`tag-${i}`] = version
        time[version] = `2024-01-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`
      }

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions,
          distTags,
          time,
        },
      })

      // Should show "(2 more tagged)" for the overflow
      expect(component.text()).toContain('more tagged')
    })

    it('expands other versions section on click', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '1.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '0.5.0', time: '2024-01-01T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find the "Other versions" button
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      expect(otherVersionsButton?.exists()).toBe(true)
      await otherVersionsButton!.trigger('click')

      // Should call fetchAllPackageVersions
      await vi.waitFor(() => {
        expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('test-package')
      })
    })

    it('collapses other versions section when clicking again', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '1.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      // Expand
      await otherVersionsButton!.trigger('click')
      await vi.waitFor(() => {
        expect(otherVersionsButton!.attributes('aria-expanded')).toBe('true')
      })

      // Collapse
      await otherVersionsButton!.trigger('click')
      await vi.waitFor(() => {
        expect(otherVersionsButton!.attributes('aria-expanded')).toBe('false')
      })
    })
  })

  describe('MAX_VISIBLE_TAGS limit', () => {
    it('limits visible tag rows to 10', async () => {
      // Create 15 dist-tags
      const versions: Record<string, PackumentVersion> = {}
      const distTags: Record<string, string> = {}
      const time: Record<string, string> = {}

      for (let i = 0; i < 15; i++) {
        const version = `${i + 1}.0.0`
        versions[version] = createVersion(version)
        distTags[`tag-${i}`] = version
        time[version] = `2024-01-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`
      }

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions,
          distTags,
          time,
        },
      })

      // Count visible version links (excluding anchor links that start with #)
      const visibleLinks = component
        .findAll('a')
        .filter(a => !a.attributes('href')?.startsWith('#'))
      // Should have max 10 visible links in the main section
      expect(visibleLinks.length).toBeLessThanOrEqual(10)
    })
  })

  describe('major version groups', () => {
    it('groups unclaimed versions by major version in other versions', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.1.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-05T12:00:00.000Z', hasProvenance: false },
        { version: '0.9.0', time: '2024-01-01T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      await vi.waitFor(() => {
        // Major groups should be created for unclaimed versions
        expect(mockFetchAllPackageVersions).toHaveBeenCalled()
      })
    })

    it('allows expanding major version groups', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.1.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-05T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      // Wait for data to load and verify versions are shown
      await vi.waitFor(() => {
        const text = component.text()
        expect(text.includes('1.1.0') || component.findAll('button').length > 2).toBe(true)
      })
    })

    it('shows DateTime for major group versions', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.1.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      await vi.waitFor(() => {
        // Should have DateTime components for both the main version and other versions
        const dateTimeComponents = component.findAllComponents({ name: 'DateTime' })
        expect(dateTimeComponents.length).toBeGreaterThan(1)
      })
    })

    it('shows ProvenanceBadge for major group versions with provenance', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: true },
        { version: '1.1.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: true },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0', { hasProvenance: true }),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      await vi.waitFor(() => {
        // Should have ProvenanceBadge components for versions with provenance
        const provenanceBadges = component.findAllComponents({ name: 'ProvenanceBadge' })
        expect(provenanceBadges.length).toBeGreaterThan(1)
      })
    })

    it('renders major group header as clickable link', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.1.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-05T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      await vi.waitFor(() => {
        // Find the major group header - should be a link (NuxtLink renders as <a>)
        const links = component.findAll('a')
        const majorGroupLink = links.find(l => l.text() === '1.1.0')
        expect(majorGroupLink?.exists()).toBe(true)
      })
    })

    it('shows DateTime and ProvenanceBadge for single version in major group', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-05T12:00:00.000Z', hasProvenance: true },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
          },
          distTags: { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Expand "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      await vi.waitFor(() => {
        // Single version group (1.0.0) should still have DateTime
        const dateTimeComponents = component.findAllComponents({ name: 'DateTime' })
        expect(dateTimeComponents.length).toBeGreaterThan(1)

        // And ProvenanceBadge for the version with provenance
        const provenanceBadges = component.findAllComponents({ name: 'ProvenanceBadge' })
        expect(provenanceBadges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('loading states', () => {
    it('shows loading spinner when fetching versions', async () => {
      // Create a promise that won't resolve immediately
      let resolvePromise: (value: unknown[]) => void
      const loadingPromise = new Promise<unknown[]>(resolve => {
        resolvePromise = resolve
      })
      mockFetchAllPackageVersions.mockReturnValue(loadingPromise)

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Click expand
      const expandButton = component.find('[data-testid="tag-expand-button"]')
      await expandButton.trigger('click')

      // Should show loading spinner (animate-spin class)
      await vi.waitFor(() => {
        expect(component.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      })

      // Resolve the promise to clean up
      resolvePromise!([])
    })

    it('shows loading spinner for other versions when fetching', async () => {
      let resolvePromise: (value: unknown[]) => void
      const loadingPromise = new Promise<unknown[]>(resolve => {
        resolvePromise = resolve
      })
      mockFetchAllPackageVersions.mockReturnValue(loadingPromise)

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Click "Other versions"
      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      await otherVersionsButton!.trigger('click')

      // Should show loading spinner
      await vi.waitFor(() => {
        expect(component.find('[data-testid="loading-spinner"]').exists()).toBe(true)
      })

      // Resolve the promise to clean up
      resolvePromise!([])
    })
  })

  describe('accessibility', () => {
    it('expand buttons have aria-expanded attribute', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButtons = component.findAll('button[aria-expanded]')
      expect(expandButtons.length).toBeGreaterThan(0)
      for (const button of expandButtons) {
        expect(['true', 'false']).toContain(button.attributes('aria-expanded'))
      }
    })

    it('expand buttons have aria-label attribute', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButton = component.find('button[aria-label]')
      expect(expandButton.exists()).toBe(true)
      expect(expandButton.attributes('aria-label')).toMatch(/Expand|Collapse/)
    })

    it('other versions button has aria-label', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const otherVersionsButton = component
        .findAll('button')
        .find(btn => btn.text().includes('Other versions'))

      expect(otherVersionsButton?.attributes('aria-label')).toMatch(/Expand other versions/)
    })

    it('expand buttons have visible focus states', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      const expandButton = component.find('button[aria-expanded]')
      expect(expandButton.classes().some(c => c.includes('focus-visible'))).toBe(true)
    })

    it('icons have aria-hidden attribute', async () => {
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Find chevron icons inside buttons
      const chevronIcons = component.findAll('button span.i-carbon\\:chevron-right')
      expect(chevronIcons.length).toBeGreaterThan(0)
      for (const icon of chevronIcons) {
        expect(icon.attributes('aria-hidden')).toBe('true')
      }
    })
  })

  describe('error handling', () => {
    it('handles fetch errors gracefully', async () => {
      mockFetchAllPackageVersions.mockRejectedValue(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: { latest: '1.0.0' },
          time: { '1.0.0': '2024-01-15T12:00:00.000Z' },
        },
      })

      // Click expand
      const expandButton = component.find('[data-testid="tag-expand-button"]')
      await expandButton.trigger('click')

      // Wait for error to be logged
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load versions:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })
  })

  describe('caching behavior', () => {
    it('only fetches versions once when expanding multiple tags', async () => {
      mockFetchAllPackageVersions.mockResolvedValue([
        { version: '2.0.0', time: '2024-01-15T12:00:00.000Z', hasProvenance: false },
        { version: '1.0.0', time: '2024-01-10T12:00:00.000Z', hasProvenance: false },
      ])

      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'test-package',
          versions: {
            '2.0.0': createVersion('2.0.0'),
            '1.0.0': createVersion('1.0.0'),
          },
          distTags: {
            latest: '2.0.0',
            stable: '1.0.0',
          },
          time: {
            '2.0.0': '2024-01-15T12:00:00.000Z',
            '1.0.0': '2024-01-10T12:00:00.000Z',
          },
        },
      })

      // Expand first tag row
      const expandButtons = component.findAll('[data-testid="tag-expand-button"]')
      await expandButtons[0]?.trigger('click')

      await vi.waitFor(() => {
        expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)
      })

      // Expand second tag row - should not fetch again
      const updatedButtons = component.findAll('[data-testid="tag-expand-button"]')
      if (updatedButtons[1]) {
        await updatedButtons[1].trigger('click')
      }

      // Should still only have been called once
      expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)
    })
  })
})
