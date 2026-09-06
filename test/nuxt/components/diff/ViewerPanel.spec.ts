import { mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockFetch, mockClipboardWrite } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockClipboardWrite: vi.fn(),
}))

const props = {
  packageName: '@scope/package',
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  file: {
    path: 'src/file #1.ts',
    type: 'modified' as const,
    oldSize: 100,
    newSize: 120,
  },
}

const fileDiffResponse = {
  package: props.packageName,
  from: props.fromVersion,
  to: props.toVersion,
  path: props.file.path,
  type: 'modify',
  hunks: [],
  stats: { additions: 0, deletions: 0 },
  meta: { large: false, truncated: false, computeTime: 1 },
}

describe('DiffViewerPanel raw diff actions', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockClipboardWrite.mockReset()
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('?format=diff')
          ? '--- a/src/index.ts\n+++ b/src/index.ts\n'
          : fileDiffResponse,
      ),
    )
    mockClipboardWrite.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { write: mockClipboardWrite },
    })
  })

  it('links to and copies the selected file as a raw diff', async () => {
    const { default: DiffViewerPanel } = await import('~/components/Diff/ViewerPanel.vue')
    vi.stubGlobal('$fetch', mockFetch)
    const wrapper = await mountSuspended(DiffViewerPanel, { props })
    const rawDiffUrl =
      '/api/registry/compare-file/%40scope/package/v/1.0.0...2.0.0/src/file%20%231.ts?format=diff'

    const viewLink = wrapper.get(`a[href="${rawDiffUrl}"]`)
    expect(viewLink.text()).toBe('View .diff')

    const copyButton = wrapper
      .findAll('button')
      .find(button => button.text().trim() === 'Copy .diff')
    expect(copyButton).toBeDefined()

    await copyButton!.trigger('click')

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(rawDiffUrl, { responseType: 'text' })
      expect(mockClipboardWrite).toHaveBeenCalledOnce()
    })

    wrapper.unmount()
  })

  it('starts the clipboard write before a slow raw diff request resolves', async () => {
    let resolveRawDiff!: (value: string) => void
    mockFetch.mockImplementation((url: string) =>
      url.includes('?format=diff')
        ? new Promise(resolve => (resolveRawDiff = resolve))
        : Promise.resolve(fileDiffResponse),
    )
    vi.stubGlobal('$fetch', mockFetch)
    const { default: DiffViewerPanel } = await import('~/components/Diff/ViewerPanel.vue')
    const wrapper = await mountSuspended(DiffViewerPanel, { props })

    const copyButton = wrapper
      .findAll('button')
      .find(button => button.text().trim() === 'Copy .diff')
    await copyButton!.trigger('click')

    expect(mockClipboardWrite).toHaveBeenCalledOnce()
    resolveRawDiff('--- a/src/index.ts\n+++ b/src/index.ts\n')
    await vi.waitFor(() => expect(copyButton!.attributes('disabled')).toBeUndefined())

    wrapper.unmount()
  })

  it('does not report a failed clipboard write as copied', async () => {
    mockClipboardWrite.mockRejectedValueOnce(new Error('clipboard denied'))
    vi.stubGlobal('$fetch', mockFetch)
    const { default: DiffViewerPanel } = await import('~/components/Diff/ViewerPanel.vue')
    const wrapper = await mountSuspended(DiffViewerPanel, { props })

    const copyButton = wrapper
      .findAll('button')
      .find(button => button.text().trim() === 'Copy .diff')
    await copyButton!.trigger('click')
    await vi.waitFor(() => expect(copyButton!.attributes('disabled')).toBeUndefined())

    expect(copyButton!.text()).toContain('Copy .diff')
    expect(copyButton!.text()).not.toContain('Copied')
    wrapper.unmount()
  })
})
