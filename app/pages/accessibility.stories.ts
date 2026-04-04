import Accessibility from './accessibility.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'

const meta = {
  component: Accessibility,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Accessibility>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
