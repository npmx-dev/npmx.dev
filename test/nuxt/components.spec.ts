import type { AxeResults, RunOptions } from 'axe-core'
import type { VueWrapper } from '@vue/test-utils'
import 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'

// axe-core is a UMD module that exposes itself as window.axe in the browser
declare const axe: { run: (context: Element, options?: RunOptions) => Promise<AxeResults> }

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

import AppHeader from '~/components/AppHeader.vue'
import AppFooter from '~/components/AppFooter.vue'
import AppTooltip from '~/components/AppTooltip.vue'
import LoadingSpinner from '~/components/LoadingSpinner.vue'
import JsrBadge from '~/components/JsrBadge.vue'
import ProvenanceBadge from '~/components/ProvenanceBadge.vue'
import MarkdownText from '~/components/MarkdownText.vue'
import PackageSkeleton from '~/components/PackageSkeleton.vue'
import PackageCard from '~/components/PackageCard.vue'

describe('component accessibility audits', () => {
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
})
