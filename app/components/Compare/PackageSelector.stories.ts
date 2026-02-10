import type { Meta, StoryObj } from '@nuxtjs/storybook'
import PackageSelector from './PackageSelector.vue'

const meta = {
  component: PackageSelector,
} satisfies Meta<typeof PackageSelector>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
