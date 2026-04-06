import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { PackageComparisonData } from '~/composables/usePackageComparison'

const mockPackagesData = ref<(PackageComparisonData | null)[]>([])
const mockStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')

mockNuxtImport('usePackageComparison', () => {
  return () => ({
    packagesData: mockPackagesData,
    status: mockStatus,
    getFacetValues: () => [],
    isFacetLoading: () => false,
    isColumnLoading: () => false,
  })
})

mockNuxtImport('useCompareReplacements', () => {
  return () => ({
    noDepSuggestions: computed(() => []),
    infoSuggestions: computed(() => []),
    replacements: computed(() => new Map()),
  })
})

function makePackageData(name: string): PackageComparisonData {
  return {
    package: { name, version: '1.0.0' } as ComparisonPackage,
    directDeps: 0,
  }
}

async function mountComparePage(route: string) {
  const ComparePage = await import('~/pages/compare.vue')
  return mountSuspended(ComparePage.default, { route })
}

describe('compare page command palette commands', () => {
  afterEach(() => {
    mockPackagesData.value = []
    mockStatus.value = 'idle'
    const commandPalette = useCommandPalette()
    commandPalette.close()
    commandPalette.contextCommands.value = []
  })

  it('does not register copy-markdown command with only 1 package', async () => {
    mockPackagesData.value = [makePackageData('react')]
    mockStatus.value = 'success'

    const wrapper = await mountComparePage('/compare?packages=react')
    const { contextCommands } = useCommandPalette()

    const allCommands = contextCommands.value.flatMap(entry => entry.commands)
    expect(allCommands.find(c => c.id === 'compare-copy-markdown')).toBeUndefined()
    expect(allCommands.find(c => c.id === 'compare-select-all')).toBeTruthy()

    wrapper.unmount()
  })

  it('does not register copy-markdown command while data is loading', async () => {
    mockPackagesData.value = [null, null]
    mockStatus.value = 'pending'

    const wrapper = await mountComparePage('/compare?packages=react,vue')
    const { contextCommands } = useCommandPalette()

    const allCommands = contextCommands.value.flatMap(entry => entry.commands)
    expect(allCommands.find(c => c.id === 'compare-copy-markdown')).toBeUndefined()

    wrapper.unmount()
  })

  it('registers copy-markdown command with 2+ packages and loaded data', async () => {
    mockPackagesData.value = [makePackageData('react'), makePackageData('vue')]
    mockStatus.value = 'success'

    const wrapper = await mountComparePage('/compare?packages=react,vue')
    const { contextCommands } = useCommandPalette()

    const allCommands = contextCommands.value.flatMap(entry => entry.commands)
    expect(allCommands.find(c => c.id === 'compare-copy-markdown')).toBeTruthy()

    wrapper.unmount()
  })
})
