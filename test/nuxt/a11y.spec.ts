import type { AxeResults, RunOptions } from 'axe-core'
import type { VueWrapper } from '@vue/test-utils'
import type { ColumnConfig, FilterChip } from '#shared/types/preferences'
import 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

// axe-core is a UMD module that exposes itself as window.axe in the browser
declare const axe: {
  run: (context: Element, options?: RunOptions) => Promise<AxeResults>
}

// Track mounted containers for cleanup
const mountedContainers: HTMLElement[] = []

/**
 * Run axe accessibility audit on a mounted component.
 * Mounts the component in an isolated container to avoid cross-test pollution.
 */
async function runAxe(wrapper: VueWrapper): Promise<AxeResults> {
  // Create an isolated container for this test
  const container = document.createElement('div')
  container.id = `test-container-${Date.now()}`
  document.body.appendChild(container)
  mountedContainers.push(container)

  // Clone the element into our isolated container
  const el = wrapper.element.cloneNode(true) as HTMLElement
  container.appendChild(el)

  // Run axe only on the isolated container
  return axe.run(container, {
    // Disable rules that don't apply to isolated component testing
    rules: {
      // These rules check page-level concerns that don't apply to isolated components
      'landmark-one-main': { enabled: false },
      'region': { enabled: false },
      'page-has-heading-one': { enabled: false },
      // Duplicate landmarks are expected when testing multiple header/footer components
      'landmark-no-duplicate-banner': { enabled: false },
      'landmark-no-duplicate-contentinfo': { enabled: false },
      'landmark-no-duplicate-main': { enabled: false },
    },
  })
}

// Clean up mounted containers after each test
afterEach(() => {
  for (const container of mountedContainers) {
    container.remove()
  }
  mountedContainers.length = 0
})

// Import components from #components where possible
// For server/client variants, we need to import directly to test the specific variant
import {
  AppFooter,
  AppHeader,
  BuildEnvironment,
  CodeDirectoryListing,
  CodeFileTree,
  CodeMobileTreeDrawer,
  CodeViewer,
  CollapsibleSection,
  ColumnPicker,
  CompareFacetCard,
  CompareFacetRow,
  CompareFacetSelector,
  CompareComparisonGrid,
  ComparePackageSelector,
  DateTime,
  DependencyPathPopup,
  FilterChips,
  FilterPanel,
  HeaderAccountMenu,
  LicenseDisplay,
  LoadingSpinner,
  MarkdownText,
  PackageChartModal,
  PackageClaimPackageModal,
  HeaderConnectorModal,
  OrgMembersPanel,
  OrgOperationsQueue,
  OrgTeamsPanel,
  PackageAccessControls,
  PackageCard,
  PackageDependencies,
  PackageDeprecatedTree,
  PackageDownloadAnalytics,
  PackageInstallScripts,
  PackageList,
  PackageListControls,
  PackageListToolbar,
  PackageMaintainers,
  PackageManagerSelect,
  PackageMetricsBadges,
  PackagePlaygrounds,
  PackageReplacement,
  PackageSkeleton,
  PackageSkillsCard,
  PackageTable,
  PackageTableRow,
  PackageVersions,
  PackageVulnerabilityTree,
  PaginationControls,
  ProvenanceBadge,
  Readme,
  SettingsAccentColorPicker,
  SettingsToggle,
  TerminalExecute,
  TerminalInstall,
  TooltipAnnounce,
  TooltipApp,
  TooltipBase,
  HeaderSearchBox,
  SearchSuggestionCard,
  VersionSelector,
  ViewModeToggle,
} from '#components'

// Server variant components must be imported directly to test the server-side render
// The #components import automatically provides the client variant
import HeaderAccountMenuServer from '~/components/Header/AccountMenu.server.vue'
import ToggleServer from '~/components/Settings/Toggle.server.vue'

describe('component accessibility audits', () => {
  describe('DateTime', () => {
    it('should have no accessibility violations with ISO string datetime', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: '2024-01-15T12:00:00.000Z' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with Date object', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: new Date('2024-01-15T12:00:00.000Z') },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with custom title', async () => {
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: '2024-01-15T12:00:00.000Z',
          title: 'Last updated on January 15, 2024',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with dateStyle', async () => {
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: '2024-01-15T12:00:00.000Z',
          dateStyle: 'medium',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with individual date parts', async () => {
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: '2024-01-15T12:00:00.000Z',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('AppHeader', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(AppHeader)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations without logo', async () => {
      const component = await mountSuspended(AppHeader, {
        props: { showLogo: false },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations without connector', async () => {
      const component = await mountSuspended(AppHeader, {
        props: { showConnector: false },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('AppFooter', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(AppFooter)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('TooltipApp', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(TooltipApp, {
        props: { text: 'Tooltip content' },
        slots: { default: '<button>Trigger</button>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('TooltipAnnounce', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(TooltipAnnounce, {
        props: { text: 'Tooltip content', isVisible: true },
        slots: { default: '<button>Trigger</button>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('LoadingSpinner', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(LoadingSpinner)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with custom text', async () => {
      const component = await mountSuspended(LoadingSpinner, {
        props: { text: 'Fetching data...' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ProvenanceBadge', () => {
    it('should have no accessibility violations without link', async () => {
      const component = await mountSuspended(ProvenanceBadge)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with link', async () => {
      const component = await mountSuspended(ProvenanceBadge, {
        props: {
          provider: 'github',
          packageName: 'vue',
          version: '3.0.0',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in compact mode', async () => {
      const component = await mountSuspended(ProvenanceBadge, {
        props: {
          provider: 'github',
          packageName: 'vue',
          version: '3.0.0',
          compact: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('MarkdownText', () => {
    it('should have no accessibility violations with plain text', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'Simple text' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with formatted text', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '**Bold** and *italic* and `code`' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageSkeleton', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageSkeleton)
      const results = await runAxe(component)
      // PackageSkeleton uses empty h1/h2 elements as skeleton placeholders.
      // These are expected since the component represents a loading state.
      // The real content will have proper heading text when loaded.
      // Filter out 'empty-heading' violations as they're expected for skeleton components.
      const violations = results.violations.filter(v => v.id !== 'empty-heading')
      expect(violations).toEqual([])
    })
  })

  describe('PackageCard', () => {
    const mockResult = {
      package: {
        name: 'vue',
        version: '3.5.0',
        description: 'The progressive JavaScript framework',
        date: '2024-01-15T00:00:00.000Z',
        keywords: ['framework', 'frontend', 'reactive'],
        links: {},
        publisher: {
          username: 'yyx990803',
        },
      },
      score: {
        final: 0.9,
        detail: { quality: 0.9, popularity: 0.9, maintenance: 0.9 },
      },
      searchScore: 100000,
    }

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageCard, {
        props: { result: mockResult },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with h2 heading', async () => {
      const component = await mountSuspended(PackageCard, {
        props: { result: mockResult, headingLevel: 'h2' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations showing publisher', async () => {
      const component = await mountSuspended(PackageCard, {
        props: { result: mockResult, showPublisher: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  // Note: PackageWeeklyDownloadStats tests are skipped because vue-data-ui VueUiSparkline
  // component has issues in the test environment (requires DOM measurements that aren't
  // available during SSR-like test mounting).

  describe('PackageChartModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(PackageChartModal, {
        props: { open: false },
        slots: { title: 'Downloads', default: '<div>Chart content</div>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    // Note: Testing the open state is challenging because native <dialog>.showModal()
    // requires the element to be in the DOM and connected, which doesn't work well
    // with the test environment's cloning approach. The dialog accessibility is
    // inherently provided by the native <dialog> element with aria-labelledby.
  })

  describe('PackageDownloadAnalytics', () => {
    const mockWeeklyDownloads = [
      {
        downloads: 1000,
        weekKey: '2024-W01',
        weekStart: '2024-01-01',
        weekEnd: '2024-01-07',
      },
      {
        downloads: 1200,
        weekKey: '2024-W02',
        weekStart: '2024-01-08',
        weekEnd: '2024-01-14',
      },
      {
        downloads: 1500,
        weekKey: '2024-W03',
        weekStart: '2024-01-15',
        weekEnd: '2024-01-21',
      },
    ]

    it('should have no accessibility violations (non-modal)', async () => {
      // Test only non-modal mode to avoid vue-data-ui chart rendering issues
      const component = await mountSuspended(PackageDownloadAnalytics, {
        props: {
          weeklyDownloads: mockWeeklyDownloads,
          packageName: 'vue',
          createdIso: '2020-01-01T00:00:00.000Z',
          inModal: false,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with empty data', async () => {
      const component = await mountSuspended(PackageDownloadAnalytics, {
        props: {
          weeklyDownloads: [],
          packageName: 'vue',
          createdIso: null,
          inModal: false,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    // Note: Modal mode tests with inModal: true are skipped because vue-data-ui VueUiXy
    // component has issues in the test environment (requires DOM measurements).
  })

  describe('PackagePlaygrounds', () => {
    it('should have no accessibility violations with single link', async () => {
      const links = [
        {
          provider: 'stackblitz',
          providerName: 'StackBlitz',
          label: 'Open in StackBlitz',
          url: 'https://stackblitz.com/example',
        },
      ]
      const component = await mountSuspended(PackagePlaygrounds, {
        props: { links },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with multiple links', async () => {
      const links = [
        {
          provider: 'stackblitz',
          providerName: 'StackBlitz',
          label: 'Open in StackBlitz',
          url: 'https://stackblitz.com/example',
        },
        {
          provider: 'codesandbox',
          providerName: 'CodeSandbox',
          label: 'Open in CodeSandbox',
          url: 'https://codesandbox.io/example',
        },
      ]
      const component = await mountSuspended(PackagePlaygrounds, {
        props: { links },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with empty links', async () => {
      const component = await mountSuspended(PackagePlaygrounds, {
        props: { links: [] },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageDependencies', () => {
    it('should have no accessibility violations without dependencies', async () => {
      const component = await mountSuspended(PackageDependencies, {
        props: { packageName: 'test-package', version: '1.0.0' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with dependencies', async () => {
      const component = await mountSuspended(PackageDependencies, {
        props: {
          packageName: 'test-package',
          version: '1.0.0',
          dependencies: {
            vue: '^3.0.0',
            lodash: '^4.17.0',
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with peer dependencies', async () => {
      const component = await mountSuspended(PackageDependencies, {
        props: {
          packageName: 'test-package',
          version: '1.0.0',
          peerDependencies: {
            vue: '^3.0.0',
          },
          peerDependenciesMeta: {
            vue: { optional: true },
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageVersions', () => {
    it('should have no accessibility violations', async () => {
      // Minimal mock data satisfying PackumentVersion type
      const mockVersion = {
        _id: 'vue@3.5.0',
        _npmVersion: '10.0.0',
        name: 'vue',
        version: '3.5.0',
        dist: { tarball: '', shasum: '', signatures: [] },
      }
      const component = await mountSuspended(PackageVersions, {
        props: {
          packageName: 'vue',
          versions: {
            '3.5.0': mockVersion,
            '3.4.0': { ...mockVersion, _id: 'vue@3.4.0', version: '3.4.0' },
          },
          distTags: {
            latest: '3.5.0',
            next: '3.4.0',
          },
          time: {
            '3.5.0': '2024-01-15T00:00:00.000Z',
            '3.4.0': '2024-01-01T00:00:00.000Z',
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageListControls', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageListControls, {
        props: {
          filter: '',
          sort: 'downloads',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with filter active', async () => {
      const component = await mountSuspended(PackageListControls, {
        props: {
          filter: 'vue',
          sort: 'downloads',
          totalCount: 100,
          filteredCount: 10,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageMaintainers', () => {
    it('should have no accessibility violations without maintainers', async () => {
      const component = await mountSuspended(PackageMaintainers, {
        props: { packageName: 'vue' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with maintainers', async () => {
      const component = await mountSuspended(PackageMaintainers, {
        props: {
          packageName: 'vue',
          maintainers: [
            { name: 'yyx990803', email: 'evan@vuejs.org' },
            { name: 'posva', email: 'posva@example.com' },
          ],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CodeViewer', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(CodeViewer, {
        props: {
          html: '<pre><code><span class="line">const x = 1;</span></code></pre>',
          lines: 1,
          selectedLines: null,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with selected lines', async () => {
      const component = await mountSuspended(CodeViewer, {
        props: {
          html: '<pre><code><span class="line">const x = 1;</span><span class="line">const y = 2;</span></code></pre>',
          lines: 2,
          selectedLines: { start: 1, end: 1 },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CodeDirectoryListing', () => {
    const mockTree = [
      { name: 'src', type: 'directory' as const, path: 'src', children: [] },
      { name: 'index.js', type: 'file' as const, path: 'index.js', size: 1024 },
      {
        name: 'package.json',
        type: 'file' as const,
        path: 'package.json',
        size: 512,
      },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(CodeDirectoryListing, {
        props: {
          tree: mockTree,
          currentPath: '',
          baseUrl: '/code/vue',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with nested path', async () => {
      const component = await mountSuspended(CodeDirectoryListing, {
        props: {
          tree: mockTree,
          currentPath: 'src',
          baseUrl: '/code/vue',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CodeFileTree', () => {
    const mockTree = [
      {
        name: 'src',
        type: 'directory' as const,
        path: 'src',
        children: [{ name: 'index.ts', type: 'file' as const, path: 'src/index.ts' }],
      },
      { name: 'package.json', type: 'file' as const, path: 'package.json' },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(CodeFileTree, {
        props: {
          tree: mockTree,
          currentPath: '',
          baseUrl: '/code/vue',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with selected file', async () => {
      const component = await mountSuspended(CodeFileTree, {
        props: {
          tree: mockTree,
          currentPath: 'src/index.ts',
          baseUrl: '/code/vue',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('HeaderConnectorModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(HeaderConnectorModal, {
        props: { open: false },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when open (disconnected)', async () => {
      const component = await mountSuspended(HeaderConnectorModal, {
        props: { open: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('HeaderAccountMenu.server', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(HeaderAccountMenuServer)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('HeaderAccountMenu', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(HeaderAccountMenu)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageClaimPackageModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(PackageClaimPackageModal, {
        props: {
          packageName: 'test-package',
          open: false,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when open', async () => {
      const component = await mountSuspended(PackageClaimPackageModal, {
        props: {
          packageName: 'test-package',
          open: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('OrgOperationsQueue', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(OrgOperationsQueue)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageList', () => {
    const mockResults = [
      {
        package: {
          name: 'vue',
          version: '3.5.0',
          description: 'The progressive JavaScript framework',
          date: '2024-01-15T00:00:00.000Z',
          keywords: ['framework'],
          links: {},
          publisher: { username: 'yyx990803' },
        },
        score: {
          final: 0.9,
          detail: { quality: 0.9, popularity: 0.9, maintenance: 0.9 },
        },
        searchScore: 100000,
      },
      {
        package: {
          name: 'react',
          version: '18.2.0',
          description: 'React is a JavaScript library for building user interfaces.',
          date: '2024-01-10T00:00:00.000Z',
          keywords: ['react'],
          links: {},
          publisher: { username: 'fb' },
        },
        score: {
          final: 0.9,
          detail: { quality: 0.9, popularity: 0.9, maintenance: 0.9 },
        },
        searchScore: 90000,
      },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageList, {
        props: { results: mockResults },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with empty results', async () => {
      const component = await mountSuspended(PackageList, {
        props: { results: [] },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when loading', async () => {
      const component = await mountSuspended(PackageList, {
        props: {
          results: mockResults,
          isLoading: true,
          hasMore: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageMetricsBadges', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageMetricsBadges, {
        props: { packageName: 'vue' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with version', async () => {
      const component = await mountSuspended(PackageMetricsBadges, {
        props: {
          packageName: 'vue',
          version: '3.5.0',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageAccessControls', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageAccessControls, {
        props: { packageName: '@nuxt/kit' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for unscoped package', async () => {
      // Unscoped packages don't show the access controls section
      const component = await mountSuspended(PackageAccessControls, {
        props: { packageName: 'vue' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('OrgMembersPanel', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(OrgMembersPanel, {
        props: { orgName: 'nuxt' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('OrgTeamsPanel', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(OrgTeamsPanel, {
        props: { orgName: 'nuxt' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CodeMobileTreeDrawer', () => {
    const mockTree = [
      {
        name: 'src',
        type: 'directory' as const,
        path: 'src',
        children: [{ name: 'index.ts', type: 'file' as const, path: 'src/index.ts' }],
      },
      { name: 'package.json', type: 'file' as const, path: 'package.json' },
    ]

    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(CodeMobileTreeDrawer, {
        props: {
          tree: mockTree,
          currentPath: '',
          baseUrl: '/code/vue',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ColumnPicker', () => {
    const mockColumns: ColumnConfig[] = [
      { id: 'name', label: 'Name', visible: true, sortable: true },
      { id: 'version', label: 'Version', visible: true, sortable: false },
      { id: 'downloads', label: 'Downloads', visible: false, sortable: true },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(ColumnPicker, {
        props: { columns: mockColumns },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('FilterChips', () => {
    it('should have no accessibility violations with chips', async () => {
      const chips: FilterChip[] = [
        { id: 'text', type: 'text', label: 'Search', value: 'react' },
        { id: 'keyword', type: 'keywords', label: 'Keyword', value: 'hooks' },
      ]
      const component = await mountSuspended(FilterChips, {
        props: { chips },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with empty chips', async () => {
      const component = await mountSuspended(FilterChips, {
        props: { chips: [] },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('FilterPanel', () => {
    const defaultFilters = {
      text: '',
      searchScope: 'name' as const,
      downloadRange: 'any' as const,
      updatedWithin: 'any' as const,
      security: 'all' as const,
      keywords: [],
    }

    it('should have no accessibility violations (collapsed)', async () => {
      const component = await mountSuspended(FilterPanel, {
        props: { filters: defaultFilters },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with active filters', async () => {
      const component = await mountSuspended(FilterPanel, {
        props: {
          filters: {
            ...defaultFilters,
            text: 'react',
            keywords: ['hooks'],
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageListToolbar', () => {
    const defaultFilters = {
      text: '',
      searchScope: 'name' as const,
      downloadRange: 'any' as const,
      updatedWithin: 'any' as const,
      security: 'all' as const,
      keywords: [],
    }

    const mockColumns: ColumnConfig[] = [
      { id: 'name', label: 'Name', visible: true, sortable: true },
      { id: 'version', label: 'Version', visible: true, sortable: false },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageListToolbar, {
        props: {
          filters: defaultFilters,
          sortOption: 'downloads-week-desc',
          viewMode: 'cards',
          columns: mockColumns,
          paginationMode: 'infinite',
          pageSize: 25,
          totalCount: 100,
          filteredCount: 100,
          activeFilters: [],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in search context', async () => {
      const component = await mountSuspended(PackageListToolbar, {
        props: {
          filters: defaultFilters,
          sortOption: 'relevance-desc',
          viewMode: 'cards',
          columns: mockColumns,
          paginationMode: 'infinite',
          pageSize: 25,
          totalCount: 100,
          filteredCount: 100,
          activeFilters: [],
          searchContext: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should total package count in paginated mode', async () => {
      const component = await mountSuspended(PackageListToolbar, {
        props: {
          filters: defaultFilters,
          sortOption: 'downloads-week-desc',
          viewMode: 'table',
          columns: mockColumns,
          paginationMode: 'paginated',
          pageSize: 25,
          totalCount: 9544,
          filteredCount: 9544,
          activeFilters: [],
        },
      })

      const html = component.html()
      expect(html).toContain('25 of 9,544')
    })
  })

  describe('PackageTable', () => {
    const mockResults = [
      {
        package: {
          name: 'vue',
          version: '3.5.0',
          description: 'The progressive JavaScript framework',
          date: '2024-01-15T00:00:00.000Z',
          keywords: ['framework'],
          links: {},
          publisher: { username: 'yyx990803' },
        },
        score: {
          final: 0.9,
          detail: { quality: 0.9, popularity: 0.9, maintenance: 0.9 },
        },
        searchScore: 100000,
      },
    ]

    const mockColumns: ColumnConfig[] = [
      { id: 'name', label: 'Name', visible: true, sortable: true },
      { id: 'version', label: 'Version', visible: true, sortable: false },
      {
        id: 'description',
        label: 'Description',
        visible: true,
        sortable: false,
      },
      { id: 'downloads', label: 'Downloads', visible: true, sortable: true },
    ]

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageTable, {
        props: {
          results: mockResults,
          columns: mockColumns,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with empty results', async () => {
      const component = await mountSuspended(PackageTable, {
        props: {
          results: [],
          columns: mockColumns,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when loading', async () => {
      const component = await mountSuspended(PackageTable, {
        props: {
          results: [],
          columns: mockColumns,
          isLoading: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageTableRow', () => {
    const mockResult = {
      package: {
        name: 'lodash',
        version: '4.17.21',
        description: 'A modern JavaScript utility library',
        date: '2024-01-01T00:00:00.000Z',
        keywords: ['utility', 'modules'],
        links: {},
        publisher: { username: 'jdalton' },
        maintainers: [{ username: 'jdalton', email: 'test@test.com' }],
      },
      downloads: { weekly: 50000000 },
      updated: '2024-01-01T00:00:00.000Z',
      score: {
        final: 0.95,
        detail: { quality: 0.95, popularity: 0.99, maintenance: 0.9 },
      },
      searchScore: 99999,
    }

    const mockColumns: ColumnConfig[] = [
      { id: 'name', label: 'Name', visible: true, sortable: true },
      { id: 'version', label: 'Version', visible: true, sortable: false },
      {
        id: 'description',
        label: 'Description',
        visible: true,
        sortable: false,
      },
    ]

    it('should have no accessibility violations', async () => {
      // PackageTableRow needs to be wrapped in a table structure
      const component = await mountSuspended(PackageTableRow, {
        props: {
          result: mockResult,
          columns: mockColumns,
        },
        global: {
          stubs: {
            // Wrap in proper table structure for accessibility
          },
        },
        attachTo: (() => {
          const table = document.createElement('table')
          const tbody = document.createElement('tbody')
          table.appendChild(tbody)
          document.body.appendChild(table)
          return tbody
        })(),
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PaginationControls', () => {
    it('should have no accessibility violations in infinite mode', async () => {
      const component = await mountSuspended(PaginationControls, {
        props: {
          mode: 'infinite',
          pageSize: 25,
          currentPage: 1,
          totalItems: 100,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in paginated mode', async () => {
      const component = await mountSuspended(PaginationControls, {
        props: {
          mode: 'paginated',
          pageSize: 25,
          currentPage: 1,
          totalItems: 100,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with multiple pages', async () => {
      const component = await mountSuspended(PaginationControls, {
        props: {
          mode: 'paginated',
          pageSize: 10,
          currentPage: 5,
          totalItems: 200,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ViewModeToggle', () => {
    it('should have no accessibility violations in cards mode', async () => {
      const component = await mountSuspended(ViewModeToggle, {
        props: { modelValue: 'cards' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in table mode', async () => {
      const component = await mountSuspended(ViewModeToggle, {
        props: { modelValue: 'table' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageVulnerabilityTree', () => {
    it('should have no accessibility violations in idle state', async () => {
      const component = await mountSuspended(PackageVulnerabilityTree, {
        props: {
          packageName: 'vue',
          version: '3.5.0',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageDeprecatedTree', () => {
    it('should have no accessibility violations in idle state', async () => {
      const component = await mountSuspended(PackageDeprecatedTree, {
        props: {
          packageName: 'vue',
          version: '3.5.0',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('DependencyPathPopup', () => {
    it('should have no accessibility violations with short path', async () => {
      const component = await mountSuspended(DependencyPathPopup, {
        props: {
          path: ['root@1.0.0', 'vuln-dep@2.0.0'],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with deep path', async () => {
      const component = await mountSuspended(DependencyPathPopup, {
        props: {
          path: ['root@1.0.0', 'dep-a@1.0.0', 'dep-b@2.0.0', 'dep-c@3.0.0', 'vulnerable-pkg@4.0.0'],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  // Compare feature components
  describe('CompareFacetSelector', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(CompareFacetSelector)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ComparePackageSelector', () => {
    it('should have no accessibility violations with no packages', async () => {
      const component = await mountSuspended(ComparePackageSelector, {
        props: { modelValue: [] },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with packages selected', async () => {
      const component = await mountSuspended(ComparePackageSelector, {
        props: { modelValue: ['vue', 'react'] },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations at max packages', async () => {
      const component = await mountSuspended(ComparePackageSelector, {
        props: { modelValue: ['vue', 'react', 'angular', 'svelte'], max: 4 },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CompareFacetRow', () => {
    it('should have no accessibility violations with basic values', async () => {
      const component = await mountSuspended(CompareFacetRow, {
        props: {
          label: 'Downloads',
          description: 'Weekly download count',
          values: [
            { raw: 1000, display: '1,000' },
            { raw: 2000, display: '2,000' },
          ],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when loading', async () => {
      const component = await mountSuspended(CompareFacetRow, {
        props: {
          label: 'Install Size',
          description: 'Total install size',
          values: [null, null],
          loading: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CompareComparisonGrid', () => {
    it('should have no accessibility violations with 2 columns', async () => {
      const component = await mountSuspended(CompareComparisonGrid, {
        props: {
          columns: 2,
          headers: ['vue', 'react'],
        },
        slots: {
          default: '<div>Grid content</div>',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with 3 columns', async () => {
      const component = await mountSuspended(CompareComparisonGrid, {
        props: {
          columns: 3,
          headers: ['vue', 'react', 'angular'],
        },
        slots: {
          default: '<div>Grid content</div>',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageManagerSelect', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageManagerSelect)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CompareFacetCard', () => {
    it('should have no accessibility violations with numeric values', async () => {
      const component = await mountSuspended(CompareFacetCard, {
        props: {
          label: 'Downloads',
          description: 'Weekly download count',
          values: [
            { raw: 1000, display: '1,000' },
            { raw: 2000, display: '2,000' },
          ],
          headers: ['vue', 'react'],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when loading', async () => {
      const component = await mountSuspended(CompareFacetCard, {
        props: {
          label: 'Install Size',
          values: [null, null],
          headers: ['vue', 'react'],
          facetLoading: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('SettingsAccentColorPicker', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(SettingsAccentColorPicker)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('TooltipBase', () => {
    it('should have no accessibility violations when hidden', async () => {
      const component = await mountSuspended(TooltipBase, {
        props: { text: 'Tooltip text', isVisible: false },
        slots: { default: '<button>Trigger</button>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when visible', async () => {
      const component = await mountSuspended(TooltipBase, {
        props: { text: 'Tooltip text', isVisible: true },
        slots: { default: '<button>Trigger</button>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('BuildEnvironment', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(BuildEnvironment)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in footer mode', async () => {
      const component = await mountSuspended(BuildEnvironment, {
        props: { footer: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('CollapsibleSection', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(CollapsibleSection, {
        props: { title: 'Section Title', id: 'test-section' },
        slots: { default: '<p>Section content</p>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with custom heading level', async () => {
      const component = await mountSuspended(CollapsibleSection, {
        props: { title: 'Section Title', id: 'test-section', headingLevel: 'h3' },
        slots: { default: '<p>Section content</p>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when loading', async () => {
      const component = await mountSuspended(CollapsibleSection, {
        props: { title: 'Section Title', id: 'test-section', isLoading: true },
        slots: { default: '<p>Loading content...</p>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('TerminalExecute', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(TerminalExecute, {
        props: { packageName: 'create-vite' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for create package', async () => {
      const component = await mountSuspended(TerminalExecute, {
        props: { packageName: 'create-vite', isCreatePackage: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('TerminalInstall', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(TerminalInstall, {
        props: { packageName: 'vue' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with version', async () => {
      const component = await mountSuspended(TerminalInstall, {
        props: { packageName: 'vue', requestedVersion: '3.5.0' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with types package', async () => {
      const component = await mountSuspended(TerminalInstall, {
        props: { packageName: 'lodash', typesPackageName: '@types/lodash' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with executable info', async () => {
      const component = await mountSuspended(TerminalInstall, {
        props: {
          packageName: 'eslint',
          executableInfo: { hasExecutable: true, primaryCommand: 'eslint' },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('LicenseDisplay', () => {
    it('should have no accessibility violations with simple license', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with compound license', async () => {
      const component = await mountSuspended(LicenseDisplay, {
        props: { license: 'MIT OR Apache-2.0' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageInstallScripts', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(PackageInstallScripts, {
        props: {
          packageName: 'esbuild',
          installScripts: {
            scripts: ['postinstall'],
            content: { postinstall: 'node install.js' },
            npxDependencies: {},
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with npx dependencies', async () => {
      const component = await mountSuspended(PackageInstallScripts, {
        props: {
          packageName: 'husky',
          installScripts: {
            scripts: ['postinstall'],
            content: { postinstall: 'husky install' },
            npxDependencies: { husky: '^9.0.0' },
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageReplacement', () => {
    it('should have no accessibility violations for native replacement', async () => {
      const component = await mountSuspended(PackageReplacement, {
        props: {
          replacement: {
            type: 'native',
            moduleName: 'array-every',
            nodeVersion: '0.10.0',
            replacement: 'Array.prototype.every',
            mdnPath: 'Global_Objects/Array/every',
            category: 'native',
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for simple replacement', async () => {
      const component = await mountSuspended(PackageReplacement, {
        props: {
          replacement: {
            type: 'simple',
            moduleName: 'underscore',
            replacement: 'lodash',
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for documented replacement', async () => {
      const component = await mountSuspended(PackageReplacement, {
        props: {
          replacement: {
            type: 'documented',
            moduleName: 'moment',
            docPath: 'moment',
          },
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('PackageSkillsCard', () => {
    it('should have no accessibility violations with skills', async () => {
      const component = await mountSuspended(PackageSkillsCard, {
        props: {
          packageName: 'vue',
          skills: [
            {
              name: 'Vue Components',
              description: 'Create Vue components',
              dirName: 'vue-components',
            },
          ],
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should render nothing when no skills', async () => {
      const component = await mountSuspended(PackageSkillsCard, {
        props: {
          packageName: 'vue',
          skills: [],
        },
      })
      // Empty skills array means the component renders nothing
      expect(component.html()).toBe('<!--v-if-->')
    })
  })

  describe('Readme', () => {
    it('should have no accessibility violations with slot content', async () => {
      const component = await mountSuspended(Readme, {
        slots: { default: '<h3>README</h3><p>Some content</p>' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('HeaderSearchBox', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(HeaderSearchBox)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('SearchSuggestionCard', () => {
    it('should have no accessibility violations for user suggestion', async () => {
      const component = await mountSuspended(SearchSuggestionCard, {
        props: { type: 'user', name: 'testuser' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for org suggestion', async () => {
      const component = await mountSuspended(SearchSuggestionCard, {
        props: { type: 'org', name: 'testorg' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations for exact match', async () => {
      const component = await mountSuspended(SearchSuggestionCard, {
        props: { type: 'user', name: 'exactuser', isExactMatch: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('Toggle.server', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(ToggleServer, {
        props: { label: 'Enable feature' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with description', async () => {
      const component = await mountSuspended(ToggleServer, {
        props: { label: 'Enable feature', description: 'This enables the feature' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('Toggle', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(SettingsToggle, {
        props: { label: 'Enable feature' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with description', async () => {
      const component = await mountSuspended(SettingsToggle, {
        props: { label: 'Enable feature', description: 'This enables the feature' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when checked', async () => {
      const component = await mountSuspended(SettingsToggle, {
        props: { label: 'Enable feature', modelValue: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('VersionSelector', () => {
    const mockVersions = {
      '3.5.0': {},
      '3.4.0': {},
      '3.3.0': {},
    }
    const mockDistTags = {
      latest: '3.5.0',
      next: '3.4.0',
    }

    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          packageName: 'vue',
          currentVersion: '3.5.0',
          versions: mockVersions,
          distTags: mockDistTags,
          urlPattern: '/vue/v/{version}',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations with non-latest version', async () => {
      const component = await mountSuspended(VersionSelector, {
        props: {
          packageName: 'vue',
          currentVersion: '3.4.0',
          versions: mockVersions,
          distTags: mockDistTags,
          urlPattern: '/vue/v/{version}',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })
})
