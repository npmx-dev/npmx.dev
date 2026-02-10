import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Settings from './settings.vue'

const meta = {
  component: Settings,
} satisfies Meta<typeof Settings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
