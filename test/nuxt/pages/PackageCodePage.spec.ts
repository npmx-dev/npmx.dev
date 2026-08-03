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

describe('package code page', () => {
  beforeEach(() => {
    clearNuxtData()
    fetchFileContent.mockClear()
  })

  it('shows the raw-file fallback instead of loading forever for large files', async () => {
    registerEndpoint('/api/registry/files/@types/vscode/v/1.118.0', () => ({
      package: '@types/vscode',
      version: '1.118.0',
      tree: [{ name: 'index.d.ts', path: 'index.d.ts', type: 'file', size: 720 * 1024 }],
    }))

    registerEndpoint('/api/registry/file/@types/vscode/v/1.118.0/index.d.ts', () => {
      fetchFileContent()
      return {
        content: '',
        html: '',
        lines: 0,
        contentType: 'text/plain',
      }
    })

    const component = await mountSuspended(PackageCodePage, {
      route: '/package-code/@types/vscode/v/1.118.0/index.d.ts',
      shallow: true,
    })

    await vi.waitFor(() => {
      expect(component.text()).toContain('File too large')
    })

    expect(component.text()).not.toContain('Loading file')
    expect(fetchFileContent).not.toHaveBeenCalled()

    const rawFileLink = component.findComponent({ name: 'LinkBase' })
    expect(rawFileLink.props('to')).toBe(
      'https://cdn.jsdelivr.net/npm/@types/vscode@1.118.0/index.d.ts',
    )
  })
})
