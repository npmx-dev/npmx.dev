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

import DateTime from '~/components/DateTime.vue'
import AppHeader from '~/components/AppHeader.vue'
import AppFooter from '~/components/AppFooter.vue'
import AppTooltip from '~/components/AppTooltip.vue'
import LoadingSpinner from '~/components/LoadingSpinner.vue'
import JsrBadge from '~/components/JsrBadge.vue'
import ProvenanceBadge from '~/components/ProvenanceBadge.vue'
import MarkdownText from '~/components/MarkdownText.vue'
import PackageSkeleton from '~/components/PackageSkeleton.vue'
import PackageCard from '~/components/PackageCard.vue'
import ChartModal from '~/components/ChartModal.vue'
import PackageDownloadAnalytics from '~/components/PackageDownloadAnalytics.vue'
import PackagePlaygrounds from '~/components/PackagePlaygrounds.vue'
import PackageDependencies from '~/components/PackageDependencies.vue'
import PackageVersions from '~/components/PackageVersions.vue'
import PackageListControls from '~/components/PackageListControls.vue'
import PackageMaintainers from '~/components/PackageMaintainers.vue'
import CodeViewer from '~/components/CodeViewer.vue'
import CodeDirectoryListing from '~/components/CodeDirectoryListing.vue'
import CodeFileTree from '~/components/CodeFileTree.vue'
import UserCombobox from '~/components/UserCombobox.vue'
import ConnectorModal from '~/components/ConnectorModal.vue'
import ConnectorStatusServer from '~/components/ConnectorStatus.server.vue'
import ConnectorStatusClient from '~/components/ConnectorStatus.client.vue'
import ClaimPackageModal from '~/components/ClaimPackageModal.vue'
import OperationsQueue from '~/components/OperationsQueue.vue'
import PackageList from '~/components/PackageList.vue'
import PackageMetricsBadges from '~/components/PackageMetricsBadges.vue'
import PackageAccessControls from '~/components/PackageAccessControls.vue'
import OrgMembersPanel from '~/components/OrgMembersPanel.vue'
import OrgTeamsPanel from '~/components/OrgTeamsPanel.vue'
import CodeMobileTreeDrawer from '~/components/CodeMobileTreeDrawer.vue'
import ColumnPicker from '~/components/ColumnPicker.vue'
import FilterChips from '~/components/FilterChips.vue'
import FilterPanel from '~/components/FilterPanel.vue'
import PackageListToolbar from '~/components/PackageListToolbar.vue'
import PackageTable from '~/components/PackageTable.vue'
import PackageTableRow from '~/components/PackageTableRow.vue'
import PaginationControls from '~/components/PaginationControls.vue'
import ViewModeToggle from '~/components/ViewModeToggle.vue'
import PackageVulnerabilityTree from '~/components/PackageVulnerabilityTree.vue'
import DependencyPathPopup from '~/components/DependencyPathPopup.vue'

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

  describe('AppTooltip', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(AppTooltip, {
        props: { text: 'Tooltip content' },
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

  describe('JsrBadge', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(JsrBadge, {
        props: { url: 'https://jsr.io/@std/fs' },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations in compact mode', async () => {
      const component = await mountSuspended(JsrBadge, {
        props: { url: 'https://jsr.io/@std/fs', compact: true },
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

  describe('ChartModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(ChartModal, {
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

  describe('UserCombobox', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(UserCombobox, {
        props: {
          suggestions: ['user1', 'user2', 'user3'],
          label: 'Select a user',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when disabled', async () => {
      const component = await mountSuspended(UserCombobox, {
        props: {
          suggestions: ['user1', 'user2'],
          disabled: true,
          label: 'Select a user',
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ConnectorModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(ConnectorModal, {
        props: { open: false },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when open (disconnected)', async () => {
      const component = await mountSuspended(ConnectorModal, {
        props: { open: true },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ConnectorStatus.server', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(ConnectorStatusServer)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ConnectorStatus.client', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(ConnectorStatusClient)
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('ClaimPackageModal', () => {
    it('should have no accessibility violations when closed', async () => {
      const component = await mountSuspended(ClaimPackageModal, {
        props: {
          packageName: 'test-package',
          open: false,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })

    it('should have no accessibility violations when open', async () => {
      const component = await mountSuspended(ClaimPackageModal, {
        props: {
          packageName: 'test-package',
          open: true,
        },
      })
      const results = await runAxe(component)
      expect(results.violations).toEqual([])
    })
  })

  describe('OperationsQueue', () => {
    it('should have no accessibility violations', async () => {
      const component = await mountSuspended(OperationsQueue)
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
})
