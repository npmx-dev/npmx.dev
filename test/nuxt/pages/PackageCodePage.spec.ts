import type { Component } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'

const fetchFileContent = vi.fn()

const pages = import.meta.glob('/app/pages/package-code/**/*.vue', {
  eager: true,
  import: 'default',
})

const PackageCodePage = pages[
  '/app/pages/package-code/[[org]]/[packageName]/v/[version]/[...filePath].vue'
] as Component

mockNuxtImport('usePackage', () => {
  return () => ({
    data: ref({
      'name': '@types/vscode',
      'dist-tags': { latest: '1.118.0' },
      'versions': { '1.118.0': { version: '1.118.0' } },
      'requestedVersion': { version: '1.118.0' },
    }),
  })
})

mockNuxtImport('useCommandPalettePackageVersions', () => {
  return () => ({
    versions: ref(['1.118.0']),
    ensureLoaded: vi.fn(),
  })
})

// Must match the package-code page and the file API.
const MAX_FILE_SIZE = 1024 * 1024
const HIGHLIGHTED_HTML = '<pre><code><span class="line">export {}</span></code></pre>'
const RAW_FILE_URL = 'https://cdn.jsdelivr.net/npm/@types/vscode@1.118.0/index.d.ts'

function registerPackageFile(size: number, fileHandler: () => unknown) {
  registerEndpoint('/api/registry/files/@types/vscode/v/1.118.0', () => ({
    package: '@types/vscode',
    version: '1.118.0',
    tree: [{ name: 'index.d.ts', path: 'index.d.ts', type: 'file', size }],
  }))

  registerEndpoint('/api/registry/file/@types/vscode/v/1.118.0/index.d.ts', fileHandler)
}

function fileResponse(lines: number) {
  return {
    content: 'export {}',
    html: HIGHLIGHTED_HTML,
    lines,
    contentType: 'text/plain',
  }
}

async function mountPackageFile() {
  return mountSuspended(PackageCodePage, {
    route: '/package-code/@types/vscode/v/1.118.0/index.d.ts',
    shallow: true,
  })
}

describe('package code page', () => {
  beforeEach(() => {
    clearNuxtData()
    fetchFileContent.mockClear()
  })

  it('renders a 720KB file instead of treating it as too large', async () => {
    registerPackageFile(720 * 1024, () => {
      fetchFileContent()
      return fileResponse(12)
    })

    const component = await mountPackageFile()

    await vi.waitFor(() => {
      expect(component.text()).toContain('12 lines')
    })

    expect(fetchFileContent).toHaveBeenCalled()
    expect(component.text()).not.toContain('File too large')
    expect(component.text()).not.toContain('Loading file')
    expect(component.text()).toContain('737.3 kB')
    expect(component.findComponent({ name: 'CodeViewer' }).props('html')).toBe(HIGHLIGHTED_HTML)
  })

  it('loads a file that is exactly the maximum size', async () => {
    registerPackageFile(MAX_FILE_SIZE, () => {
      fetchFileContent()
      return fileResponse(1)
    })

    const component = await mountPackageFile()

    await vi.waitFor(() => {
      expect(fetchFileContent).toHaveBeenCalled()
    })

    expect(component.text()).not.toContain('File too large')
    expect(component.text()).toContain('1 line')
    expect(component.findComponent({ name: 'CodeViewer' }).props('html')).toBe(HIGHLIGHTED_HTML)
  })

  it('shows the raw-file fallback instead of loading forever for large files', async () => {
    registerPackageFile(MAX_FILE_SIZE + 1, () => {
      fetchFileContent()
      return fileResponse(0)
    })

    const component = await mountPackageFile()

    await vi.waitFor(() => {
      expect(component.text()).toContain('File too large')
    })

    expect(component.text()).not.toContain('Loading file')
    expect(fetchFileContent).not.toHaveBeenCalled()

    const rawFileLink = component.findComponent({ name: 'LinkBase' })
    expect(rawFileLink.props('to')).toBe(RAW_FILE_URL)
  })

  it('shows the file fetch error for a file within the size limit', async () => {
    registerPackageFile(720 * 1024, () => {
      fetchFileContent()
      throw new Error('Failed to fetch file content')
    })

    const component = await mountPackageFile()

    await vi.waitFor(() => {
      expect(component.text()).toContain('Failed to load file')
    })

    expect(fetchFileContent).toHaveBeenCalled()
    expect(component.text()).not.toContain('File too large')
  })
})
