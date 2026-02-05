import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

const { mockFetchPackageDownloadEvolution } = vi.hoisted(() => ({
  mockFetchPackageDownloadEvolution: vi.fn(),
}))

mockNuxtImport('useCharts', () => {
  return () => ({
    fetchPackageDownloadEvolution: (...args: unknown[]) =>
      mockFetchPackageDownloadEvolution(...args),
  })
})

vi.mock('vue-data-ui/vue-ui-sparkline', () => ({
  VueUiSparkline: defineComponent({
    name: 'VueUiSparkline',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', { class: attrs.class }, slots.default?.() ?? [])
    },
  }),
}))

import PackageWeeklyDownloadStats from '~/components/Package/WeeklyDownloadStats.vue'

describe('PackageWeeklyDownloadStats', () => {
  const baseProps = {
    packageName: 'test-package',
    createdIso: '2026-02-05T00:00:00.000Z',
  }

  it('hides the section when weekly downloads are empty', async () => {
    mockFetchPackageDownloadEvolution.mockReset()
    mockFetchPackageDownloadEvolution.mockResolvedValue([])

    const component = await mountSuspended(PackageWeeklyDownloadStats, {
      props: baseProps,
    })

    expect(component.text()).not.toContain('Weekly Downloads')
  })

  it('shows the section when weekly downloads exist', async () => {
    mockFetchPackageDownloadEvolution.mockReset()
    mockFetchPackageDownloadEvolution.mockResolvedValue([
      {
        weekStart: '2026-01-01',
        weekEnd: '2026-01-07',
        timestampStart: 1767225600000,
        timestampEnd: 1767744000000,
        downloads: 42,
      },
    ])

    const component = await mountSuspended(PackageWeeklyDownloadStats, {
      props: baseProps,
    })

    expect(component.text()).toContain('Weekly Downloads')
  })
})
