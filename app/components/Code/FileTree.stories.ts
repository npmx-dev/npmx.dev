import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { PackageFileTree } from '#shared/types/npm-registry'
import FileTree from './FileTree.vue'

const tree: PackageFileTree[] = [
  {
    name: 'src',
    path: 'src',
    type: 'directory',
    size: 5120,
    children: [
      { name: 'index.ts', path: 'src/index.ts', type: 'file', size: 1024 },
      {
        name: 'utils',
        path: 'src/utils',
        type: 'directory',
        size: 2048,
        children: [{ name: 'format.ts', path: 'src/utils/format.ts', type: 'file', size: 512 }],
      },
    ],
  },
  {
    name: 'dist',
    path: 'dist',
    type: 'directory',
    size: 8192,
    children: [{ name: 'index.js', path: 'dist/index.js', type: 'file', size: 4096 }],
  },
  { name: 'package.json', path: 'package.json', type: 'file', size: 640 },
  { name: 'README.md', path: 'README.md', type: 'file', size: 2200 },
]

const baseRoute = {
  params: { org: undefined, packageName: 'mock-package', version: '1.0.0' },
}

const meta = {
  component: FileTree,
  tags: ['autodocs'],
  args: {
    tree,
    currentPath: '',
    baseUrl: 'mock-package@1.0.0',
    baseRoute,
  },
  decorators: [
    () => ({ template: '<div class="w-72 border border-border bg-bg-subtle"><story /></div>' }),
  ],
} satisfies Meta<typeof FileTree>

export default meta
type Story = StoryObj<typeof meta>

/** Collapsed tree with nothing selected. */
export const Default: Story = {}

/**
 * With a file selected, its ancestor directories auto-expand and the active
 * file is highlighted.
 */
export const WithSelectedFile: Story = {
  args: {
    baseUrl: 'mock-package-selected@1.0.0',
    currentPath: 'src/utils/format.ts',
  },
}
