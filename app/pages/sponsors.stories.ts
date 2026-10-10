import Sponsors from './sponsors.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'

const meta = {
  component: Sponsors,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Sponsors>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
