import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import BaseCard from './BaseCard.vue'

const meta = {
  component: BaseCard,
  tags: ['autodocs'],
  render: args => ({
    components: { BaseCard },
    setup() {
      return { args }
    },
    template: `
      <div class="max-w-md">
        <BaseCard v-bind="args">
          <h3 class="font-semibold text-fg">example-package</h3>
          <p class="text-sm text-fg-muted mt-1">A short description of what this package does.</p>
        </BaseCard>
      </div>
    `,
  }),
} satisfies Meta<typeof BaseCard>

export default meta
type Story = StoryObj<typeof meta>

/** Default card used across search results and listings. */
export const Default: Story = {}

/** Highlighted state for the result that exactly matches the query. */
export const ExactMatch: Story = {
  args: {
    isExactMatch: true,
  },
}

/** Keyboard/pointer selection state. */
export const Selected: Story = {
  args: {
    selected: true,
  },
}
