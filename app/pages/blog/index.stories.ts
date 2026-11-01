import Blog from './index.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../../.storybook/decorators'

const meta = {
  component: Blog,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Blog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
