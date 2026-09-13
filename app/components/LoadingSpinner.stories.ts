import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LoadingSpinner from './LoadingSpinner.vue'

const meta = {
  component: LoadingSpinner,
  tags: ['autodocs'],
} satisfies Meta<typeof LoadingSpinner>

export default meta
type Story = StoryObj<typeof meta>

/** Falls back to the localised "Loading…" label when no text is given. */
export const Default: Story = {}

/** Custom label alongside the spinner. */
export const WithText: Story = {
  args: {
    text: 'Fetching package metadata…',
  },
}
