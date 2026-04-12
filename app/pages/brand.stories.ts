import Brand from './brand.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'

const meta = {
  component: Brand,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Brand>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
