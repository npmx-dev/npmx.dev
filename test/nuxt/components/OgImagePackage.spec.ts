import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const { mockUseResolvedVersion, mockUsePackage, mockUseRepoMeta } = vi.hoisted(() => ({
  mockUseResolvedVersion: vi.fn(),
  mockUsePackage: vi.fn(),
  mockUseRepoMeta: vi.fn(),
}))

mockNuxtImport('useResolvedVersion', () => mockUseResolvedVersion)
mockNuxtImport('usePackage', () => mockUsePackage)
mockNuxtImport('useRepoMeta', () => mockUseRepoMeta)
mockNuxtImport('normalizeGitUrl', () => () => 'https://github.com/test/repo')

// Mock explicit imports used by sparkline
vi.mock('~/utils/npm/api', () => ({
  fetchNpmDownloadsRange: vi.fn().mockResolvedValue(null),
}))
vi.mock('~/composables/useCharts', () => ({
  useCharts: vi.fn().mockReturnValue({
    fetchPackageDownloadEvolution: vi.fn().mockResolvedValue([]),
  }),
  buildRollingWeeklyEvolutionFromDaily: vi.fn().mockReturnValue([]),
  smoothPath: vi.fn().mockReturnValue(''),
}))

import OgImagePackage from '~/components/OgImage/Package.takumi.vue'

describe('OgImagePackage', () => {
  const baseProps = {
    name: 'test-package',
    version: '1.0.0',
    variant: 'download-chart' as const,
  }

  function setupMocks(
    overrides: {
      stars?: number
      license?: string | null
      packageName?: string
    } = {},
  ) {
    const { stars = 0, license = 'MIT', packageName = 'test-package' } = overrides

    mockUseResolvedVersion.mockReturnValue({
      data: ref('1.0.0'),
      status: ref('success'),
      error: ref(null),
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
      meta: computed(() => null),
      repoRef: computed(() => ({ owner: 'test', repo: 'repo' })),
      starsLink: computed(() => ''),
      forks: computed(() => 0),
      forksLink: computed(() => ''),
      stars: computed(() => stars),
      refresh: vi.fn().mockResolvedValue(undefined),
    })

    registerEndpoint(`/api/social/likes/${packageName}`, () => ({
      totalLikes: 0,
      userHasLiked: false,
    }))
  }

  beforeEach(() => {
    mockUseResolvedVersion.mockReset()
    mockUsePackage.mockReset()
    mockUseRepoMeta.mockReset()
  })

  it('renders the package name', async () => {
    setupMocks({ packageName: 'vue' })

    const component = await mountSuspended(OgImagePackage, {
      props: { ...baseProps, name: 'vue' },
    })

    expect(component.text()).toContain('vue')
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

  it('renders repo info', async () => {
    setupMocks()

    const component = await mountSuspended(OgImagePackage, {
      props: baseProps,
    })

    expect(component.text()).toContain('test')
    expect(component.text()).toContain('repo')
  })
})
