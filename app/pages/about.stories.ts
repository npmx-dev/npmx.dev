import About from './about.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'

const meta = {
  component: About,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof About>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
