import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import SkeletonInline from './SkeletonInline.vue'

const meta = {
  component: SkeletonInline,
  tags: ['autodocs'],
} satisfies Meta<typeof SkeletonInline>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Inline loading placeholder for a single value. Width and height come from
 * the surrounding text context.
 */
export const Default: Story = {
  render: () => ({
    components: { SkeletonInline },
    template: '<SkeletonInline class="w-64 h-4" />',
  }),
}

/** Sitting inline within a line of text. */
export const InText: Story = {
  render: () => ({
    components: { SkeletonInline },
    template: `
      <p class="text-sm text-fg-muted">
        Downloaded <SkeletonInline class="w-4 h-3.5 align-middle" /> times this week.
      </p>
    `,
  }),
}
