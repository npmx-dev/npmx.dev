import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Privacy from './privacy.vue'

const meta = {
  component: Privacy,
} satisfies Meta<typeof Privacy>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
