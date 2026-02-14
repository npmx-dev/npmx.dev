import type { Meta, StoryObj } from '@nuxtjs/storybook'
import Component from './Base.vue'

const meta = {
  component: Component,
} satisfies Meta<typeof Component>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    default: 'Primary Button',
  },
}

export const Secondary: Story = {
  args: {
    default: 'Secondary Button',
    variant: 'secondary',
  },
}

export const Small: Story = {
  args: {
    default: 'Small Button',
    size: 'small',
    variant: 'secondary',
  },
}

export const Disabled: Story = {
  args: {
    default: 'Disabled Button',
    disabled: true,
  },
}

export const WithIcon: Story = {
  args: {
    default: 'Search',
    classicon: 'i-carbon:search',
    variant: 'secondary',
  },
}

export const WithKeyboardShortcut: Story = {
  args: {
    ariaKeyshortcuts: '/',
    default: 'Search',
    variant: 'secondary',
  },
}

export const Block: Story = {
  args: {
    block: true,
    default: 'Full Width Button',
  },
}
