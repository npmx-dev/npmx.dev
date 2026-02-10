import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockUseResolvedVersion, mockUsePackageDownloads, mockUsePackage, mockUseRepoMeta } =
  vi.hoisted(() => ({
    mockUseResolvedVersion: vi.fn(),
    mockUsePackageDownloads: vi.fn(),
    mockUsePackage: vi.fn(),
    mockUseRepoMeta: vi.fn(),
  }))

mockNuxtImport('useResolvedVersion', () => mockUseResolvedVersion)
mockNuxtImport('usePackageDownloads', () => mockUsePackageDownloads)
mockNuxtImport('usePackage', () => mockUsePackage)
mockNuxtImport('useRepoMeta', () => mockUseRepoMeta)
mockNuxtImport('normalizeGitUrl', () => () => 'https://github.com/test/repo')

import OgImagePackage from '~/components/OgImage/Package.vue'

describe('OgImagePackage', () => {
  const baseProps = {
    name: 'test-package',
    version: '1.0.0',
  }

  function setupMocks(
    overrides: {
      stars?: number
      totalLikes?: number
      downloads?: number | null
      license?: string | null
      packageName?: string
    } = {},
  ) {
    const {
      stars = 0,
      totalLikes = 0,
      downloads = 1000,
      license = 'MIT',
      packageName = 'test-package',
    } = overrides

    mockUseResolvedVersion.mockReturnValue({
      data: ref('1.0.0'),
      status: ref('success'),
      error: ref(null),
    })

    mockUsePackageDownloads.mockReturnValue({
      data: downloads != null ? ref({ downloads }) : ref(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    mockUsePackage.mockReturnValue({
      data: ref({
        name: packageName,
        license,
        requestedVersion: {
          repository: { url: 'git+https://github.com/test/repo.git' },
        },
      }),
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    mockUseRepoMeta.mockReturnValue({
      stars: computed(() => stars),
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    // Mock the likes API endpoint used by useFetch
    registerEndpoint(`/api/social/likes/${packageName}`, () => ({
      totalLikes,
      userHasLiked: false,
    }))
  }

  beforeEach(() => {
    mockUseResolvedVersion.mockReset()
    mockUsePackageDownloads.mockReset()
    mockUsePackage.mockReset()
    mockUseRepoMeta.mockReset()
  })

  it('renders the package name and version', async () => {
    setupMocks({ packageName: 'vue' })

    const component = await mountSuspended(OgImagePackage, {
      props: { ...baseProps, name: 'vue' },
    })

    expect(component.text()).toContain('vue')
    expect(component.text()).toContain('1.0.0')
  })

  describe('license', () => {
    it('renders the license when present', async () => {
      setupMocks({ license: 'MIT' })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.text()).toContain('MIT')
    })

    it('hides the license section when license is missing', async () => {
      setupMocks({ license: null })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.find('[data-testid="license"]').exists()).toBe(false)
    })
  })

  describe('stars', () => {
    it('hides stars section when count is 0', async () => {
      setupMocks({ stars: 0 })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.find('[data-testid="stars"]').exists()).toBe(false)
    })

    it('shows formatted stars when count is positive', async () => {
      setupMocks({ stars: 45200 })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.text()).toContain('45.2K')
    })
  })

  describe('likes', () => {
    it('hides likes section when totalLikes is 0', async () => {
      setupMocks({ totalLikes: 0 })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.find('[data-testid="likes"]').exists()).toBe(false)
    })

    it('shows likes section when totalLikes is positive', async () => {
      setupMocks({ totalLikes: 42 })

      const component = await mountSuspended(OgImagePackage, {
        props: baseProps,
      })

      expect(component.text()).toContain('42')
    })
  })
})
