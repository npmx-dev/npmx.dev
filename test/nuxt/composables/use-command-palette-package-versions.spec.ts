import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const mockFetchAllPackageVersions = vi.fn()

vi.mock('~/utils/npm/api', () => ({
  fetchAllPackageVersions: (...args: unknown[]) => mockFetchAllPackageVersions(...args),
}))

async function capturePackageVersions(initialPackageName: string | null) {
  const { useCommandPalettePackageVersions } =
    await import('~/composables/useCommandPalettePackageVersions')

  const packageName = ref(initialPackageName)
  let result!: ReturnType<typeof useCommandPalettePackageVersions>

  const wrapper = mount(
    defineComponent({
      name: 'CommandPalettePackageVersionsHarness',
      setup() {
        result = useCommandPalettePackageVersions(() => packageName.value)
        return () => h('div')
      },
    }),
  )

  await nextTick()

  return {
    wrapper,
    packageName,
    result,
  }
}

afterEach(() => {
  mockFetchAllPackageVersions.mockReset()
})

describe('useCommandPalettePackageVersions', () => {
  it('dedupes concurrent loads for the same package', async () => {
    let resolveFetch!: (value: Array<{ version: string }>) => void
    mockFetchAllPackageVersions.mockImplementation(
      () =>
        new Promise<Array<{ version: string }>>(resolve => {
          resolveFetch = resolve
        }),
    )

    const { wrapper, result } = await capturePackageVersions('vue')

    const firstLoad = result.ensureLoaded()
    const secondLoad = result.ensureLoaded()

    expect(mockFetchAllPackageVersions).toHaveBeenCalledTimes(1)
    expect(mockFetchAllPackageVersions).toHaveBeenCalledWith('vue')

    resolveFetch([{ version: '3.5.0' }])
    await Promise.all([firstLoad, secondLoad])

    expect(result.versions.value).toEqual(['3.5.0'])

    wrapper.unmount()
  })

  it('resets cached versions when the package changes', async () => {
    mockFetchAllPackageVersions
      .mockResolvedValueOnce([{ version: '3.5.0' }])
      .mockResolvedValueOnce([{ version: '19.0.0' }])

    const { wrapper, packageName, result } = await capturePackageVersions('vue')

    await result.ensureLoaded()
    expect(result.versions.value).toEqual(['3.5.0'])

    packageName.value = 'react'
    await nextTick()

    expect(result.versions.value).toBeNull()

    await result.ensureLoaded()

    expect(mockFetchAllPackageVersions).toHaveBeenNthCalledWith(2, 'react')
    expect(result.versions.value).toEqual(['19.0.0'])

    wrapper.unmount()
  })

  it('ignores stale async results after the package name changes', async () => {
    const pendingFetches = new Map<string, (value: Array<{ version: string }>) => void>()
    mockFetchAllPackageVersions.mockImplementation(
      (packageName: string) =>
        new Promise<Array<{ version: string }>>(resolve => {
          pendingFetches.set(packageName, resolve)
        }),
    )

    const { wrapper, packageName, result } = await capturePackageVersions('vue')

    const vueLoad = result.ensureLoaded()

    packageName.value = 'react'
    await nextTick()

    const reactLoad = result.ensureLoaded()

    pendingFetches.get('vue')?.([{ version: '3.5.0' }])
    await vueLoad
    await nextTick()

    expect(result.versions.value).toBeNull()

    pendingFetches.get('react')?.([{ version: '19.0.0' }])
    await reactLoad

    expect(result.versions.value).toEqual(['19.0.0'])

    wrapper.unmount()
  })
})
