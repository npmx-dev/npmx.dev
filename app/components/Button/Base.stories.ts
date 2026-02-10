import type { Meta, StoryObj } from '@nuxtjs/storybook'
import ButtonBase from './Base.vue'

const meta = {
  component: ButtonBase,
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonBase>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Primary Button</ButtonBase>',
  }),
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'medium',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Secondary Button</ButtonBase>',
  }),
}

export const Small: Story = {
  args: {
    variant: 'secondary',
    size: 'small',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Small Button</ButtonBase>',
  }),
}

export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    disabled: true,
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Disabled Button</ButtonBase>',
  }),
}

export const WithIcon: Story = {
  args: {
    variant: 'secondary',
    size: 'medium',
    classicon: 'i-carbon:search',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Search</ButtonBase>',
  }),
}

export const WithKeyboardShortcut: Story = {
  args: {
    variant: 'secondary',
    size: 'medium',
    ariaKeyshortcuts: '/',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Search</ButtonBase>',
  }),
}

export const Block: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    block: true,
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: '<ButtonBase v-bind="args">Full Width Button</ButtonBase>',
  }),
}
