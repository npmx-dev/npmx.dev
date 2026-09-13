import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import SkeletonBlock from './SkeletonBlock.vue'

const meta = {
  component: SkeletonBlock,
  tags: ['autodocs'],
} satisfies Meta<typeof SkeletonBlock>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Block-level loading placeholder. Size it with the surrounding layout —
 * here a fixed width and height stand in for a card.
 */
export const Default: Story = {
  render: () => ({
    components: { SkeletonBlock },
    template: '<SkeletonBlock class="w-64 h-4" />',
  }),
}

/** Stacked placeholders standing in for a list of items. */
export const List: Story = {
  render: () => ({
    components: { SkeletonBlock },
    template: `
      <div class="flex flex-col gap-2 w-80">
        <SkeletonBlock class="h-5 w-1/2" />
        <SkeletonBlock class="h-4 w-full" />
        <SkeletonBlock class="h-4 w-5/6" />
      </div>
    `,
  }),
}
