import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Component from './Default.vue'

const meta = {
  component: Component,
  decorators: [
    () => ({
      template: '<div style="width:1200px;height:630px; outline:1px solid red"><story/></div>',
    }),
  ],
  argTypes: {
    primaryColor: {
      control: { type: 'color' },
      description: 'Primary color used throughout the OG image',
    },
    title: {
      control: { type: 'text' },
      description: 'Main title displayed in the OG image',
    },
    description: {
      control: { type: 'text' },
      description: 'Description text (supports **bold** markdown)',
    },
  },
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const CustomContent: Story = {
  args: {
    title: 'Custom Package',
    description: 'an awesome **customizable** OG image generator',
    primaryColor: '#f59e0b',
  },
}
