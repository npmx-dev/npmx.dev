import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { PackageFileTree } from '#shared/types/npm-registry'
import MobileTreeDrawer from './MobileTreeDrawer.vue'

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
  { name: 'package.json', path: 'package.json', type: 'file', size: 640 },
  { name: 'README.md', path: 'README.md', type: 'file', size: 2200 },
]

const baseRoute = {
  params: { org: undefined, packageName: 'mock-package', version: '1.0.0' },
}

const meta = {
  component: MobileTreeDrawer,
  tags: ['autodocs'],
  args: {
    tree,
    currentPath: 'src/index.ts',
    baseUrl: 'mock-package@1.0.0',
    baseRoute,
  },
} satisfies Meta<typeof MobileTreeDrawer>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Slide-in file tree for small screens. The drawer is hidden at `md` and wider,
 * so view this story in a narrow viewport. Use the button to toggle it open.
 */
export const Default: Story = {
  render: args => ({
    components: { MobileTreeDrawer },
    setup() {
      return { args }
    },
    template: `
      <div>
        <button
          class="md:hidden px-3 py-1.5 bg-bg-muted border border-border rounded-md text-sm"
          @click="$refs.drawer.toggle()"
        >
          Toggle drawer
        </button>
        <p class="hidden md:block text-sm text-fg-muted">
          This drawer only renders below the <code>md</code> breakpoint. Switch to a narrow viewport to see it.
        </p>
        <MobileTreeDrawer ref="drawer" v-bind="args" />
      </div>
    `,
  }),
}
