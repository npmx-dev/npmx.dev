import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import SkeletonLoader from './SkeletonLoader.vue'

const meta = {
  component: SkeletonLoader,
  tags: ['autodocs'],
  decorators: [
    () => ({ template: '<div class="h-125 border border-border bg-bg-subtle"><story /></div>' }),
  ],
} satisfies Meta<typeof SkeletonLoader>

export default meta
type Story = StoryObj<typeof meta>

/** Loading placeholder shown while a file's contents are being fetched. */
export const Default: Story = {}
