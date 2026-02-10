import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Component from './LicenseDisplay.vue'

const meta = {
  component: Component,
  argTypes: {
    license: {
      control: { type: 'text' },
    },
  },
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = { args: { license: 'MIT' } }
export const Invalid: Story = { args: { license: 'invalid license' } }
