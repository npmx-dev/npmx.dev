import type { Meta, StoryObj } from '@nuxtjs/storybook'
import LoadingSpinner from './LoadingSpinner.vue'

const meta = {
  component: LoadingSpinner,
} satisfies Meta<typeof LoadingSpinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCustomText: Story = {
  args: {
    text: 'Loading packages...',
  },
}
