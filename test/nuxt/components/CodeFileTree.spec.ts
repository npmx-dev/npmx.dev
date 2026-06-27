import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import CodeFileTree from '~/components/Code/FileTree.vue'

const mockTree: PackageFileTree[] = [
  {
    name: 'distribution',
    type: 'directory',
    path: 'distribution',
    children: [
      {
        name: 'core',
        type: 'directory',
        path: 'distribution/core',
        children: [
          {
            name: 'constants.d.ts',
            type: 'file',
            path: 'distribution/core/constants.d.ts',
          },
        ],
      },
      {
        name: 'types',
        type: 'directory',
        path: 'distribution/types',
        children: [
          {
            name: 'common.d.ts',
            type: 'file',
            path: 'distribution/types/common.d.ts',
          },
        ],
      },
    ],
  },
]

function findDirButton(wrapper: Awaited<ReturnType<typeof mountCodeFileTree>>, name: string) {
  return wrapper.findAll('button').find(button => button.text().trim() === name)
}

async function mountCodeFileTree() {
  return mountSuspended(CodeFileTree, {
    attachTo: document.body,
    props: {
      tree: mockTree,
      currentPath: 'distribution/core/constants.d.ts',
      baseUrl: '/package-code/ky/v/1.14.3/distribution/core/constants.d.ts?test=tree',
      baseRoute: {
        params: {
          packageName: 'ky',
          version: '1.14.3',
          filePath: '',
        },
      },
    },
  })
}

describe('CodeFileTree', () => {
  it('expands and collapses a directory when clicked', async () => {
    const wrapper = await mountCodeFileTree()
    try {
      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('constants.d.ts')
        expect(wrapper.text()).not.toContain('common.d.ts')
      })

      const coreButton = findDirButton(wrapper, 'core')
      expect(coreButton).toBeDefined()
      await coreButton!.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).not.toContain('constants.d.ts')
        expect(wrapper.text()).not.toContain('common.d.ts')
      })

      const typesButton = findDirButton(wrapper, 'types')
      expect(typesButton).toBeDefined()
      await typesButton!.trigger('click')

      await vi.waitFor(() => {
        expect(wrapper.text()).toContain('common.d.ts')
        expect(wrapper.text()).not.toContain('constants.d.ts')
      })
    } finally {
      wrapper.unmount()
    }
  })
})
