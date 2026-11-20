import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import ViewerPanel from '~/components/Diff/ViewerPanel.vue'

const RAW_DIFF = '--- a/index.js\n+++ b/index.js\n@@ -1,1 +1,1 @@\n-a\n+b\n'

function mountPanel(path: string) {
  return mountSuspended(ViewerPanel, {
    props: {
      packageName: 'test-package',
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      file: { path, type: 'modified' as const, oldSize: 2, newSize: 2 },
    },
  })
}

function registerDiff(path: string, hunks: FileDiffResponse['hunks']) {
  registerEndpoint(`/api/registry/compare-file/test-package/v/1.0.0...2.0.0/${path}`, event =>
    getQuery(event).format === 'diff'
      ? RAW_DIFF
      : {
          package: 'test-package',
          from: '1.0.0',
          to: '2.0.0',
          path,
          type: 'modify',
          hunks,
          stats: { additions: 1, deletions: 1 },
          meta: {},
        },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DiffViewerPanel raw diff actions', () => {
  it('links to and copies the raw diff for the selected file', async () => {
    registerDiff('changed.js', [
      {
        type: 'hunk',
        content: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [{ type: 'delete', oldLineNumber: 1, content: [{ value: 'a', type: 'normal' }] }],
      },
    ])
    const write = vi.spyOn(navigator.clipboard, 'write').mockResolvedValue()

    const component = await mountPanel('changed.js')
    await vi.waitFor(() => expect(component.text()).toContain('View .diff'))

    const link = component.findAll('a').find(a => a.text() === 'View .diff')!
    expect(link.attributes('href')).toBe(
      '/api/registry/compare-file/test-package/v/1.0.0...2.0.0/changed.js?format=diff',
    )
    expect(link.attributes('target')).toBe('_blank')

    const button = component.findAll('button').find(b => b.text() === 'Copy .diff')!
    await button.trigger('click')
    await vi.waitFor(() => expect(button.text()).toBe('copied!'))

    const [item] = write.mock.calls[0]![0]
    const copied = await (await item!.getType('text/plain')).text()
    expect(copied).toBe(RAW_DIFF)
  })

  it('hides the raw diff actions when the file has no content changes', async () => {
    registerDiff('unchanged.js', [])

    const component = await mountPanel('unchanged.js')
    await vi.waitFor(() => expect(component.text()).toContain('No content changes detected'))

    expect(component.text()).not.toContain('View .diff')
    expect(component.text()).not.toContain('Copy .diff')
  })
})
