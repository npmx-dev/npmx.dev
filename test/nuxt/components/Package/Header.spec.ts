import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import PackageHeader from '~/components/Package/Header.vue'

const { mockUsePackageRoute } = vi.hoisted(() => ({
  mockUsePackageRoute: vi.fn(),
}))

mockNuxtImport('usePackageRoute', () => mockUsePackageRoute)

function setRoute({
  requestedVersion = null as string | null,
  orgName = null as string | null,
} = {}) {
  mockUsePackageRoute.mockReturnValue({
    packageName: computed(() => 'vue'),
    requestedVersion: computed(() => requestedVersion),
    orgName: computed(() => orgName),
  })
}

const baseProps = {
  pkg: {
    'name': 'vue',
    'dist-tags': {},
    'versions': {},
  },
  resolvedVersion: '3.5.0',
  displayVersion: {
    _id: '1234567890',
    _npmVersion: '3.5.0',
    name: 'vue',
    version: '3.5.0',
    dist: {
      shasum: '1234567890',
      signatures: [],
      tarball: 'https://npmx.dev/package/vue/tarball',
    },
  },
  latestVersion: { version: '3.5.0', tags: [] },
  provenanceData: null,
  provenanceStatus: 'idle',
  page: 'docs' as const,
  versionUrlPattern: '/package/vue/v/{version}',
}

function mountHeader() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return mountSuspended(PackageHeader, { props: baseProps as any })
}

describe('PackageHeader version display', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    mockUsePackageRoute.mockReset()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('hides the resolved version in the title when the URL has no explicit version', async () => {
    setRoute({ requestedVersion: null })

    wrapper = await mountHeader()

    // The <h1> title should show only the package name, not "@3.5.0"
    expect(wrapper.get('h1').text()).not.toContain('3.5.0')
    // The version copy button should not be rendered
    expect(wrapper.text()).not.toContain('Copy package version')
  })

  it('shows the resolved version in the title when the URL has an explicit version', async () => {
    setRoute({ requestedVersion: '3.5.0' })

    wrapper = await mountHeader()

    expect(wrapper.get('h1').text()).toContain('3.5.0')
    expect(wrapper.text()).toContain('Copy package version')
  })

  it('renders separate copy buttons for the package name and the version', async () => {
    setRoute({ requestedVersion: '3.5.0' })

    wrapper = await mountHeader()

    const copyButtonLabels = wrapper
      .findAll('button')
      .map(b => b.text())
      .filter(text => text.includes('Copy package'))

    expect(copyButtonLabels.some(text => text.includes('Copy package name'))).toBe(true)
    expect(copyButtonLabels.some(text => text.includes('Copy package version'))).toBe(true)
  })

  it('shows the resolved version for a dist-tag request (e.g. /v/latest)', async () => {
    // requestedVersion is the raw URL segment ("latest"); resolvedVersion is the concrete number
    setRoute({ requestedVersion: 'latest' })

    wrapper = await mountHeader()

    expect(wrapper.get('h1').text()).toContain('3.5.0')
  })
})
