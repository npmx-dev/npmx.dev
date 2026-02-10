import type { Meta, StoryObj } from '@nuxtjs/storybook'
import TagStatic from './Static.vue'

const meta = {
  component: TagStatic,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'ghost'],
      description: 'Tag visual style variant',
    },
    as: {
      control: 'text',
      description: 'HTML element to render as',
    },
  },
} satisfies Meta<typeof TagStatic>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    variant: 'default',
  },
  render: args => ({
    components: { TagStatic },
    setup() {
      return { args }
    },
    template: '<TagStatic v-bind="args">latest</TagStatic>',
  }),
}

export const Ghost: Story = {
  args: {
    variant: 'ghost',
  },
  render: args => ({
    components: { TagStatic },
    setup() {
      return { args }
    },
    template: '<TagStatic v-bind="args">deprecated</TagStatic>',
  }),
}

export const WithIcon: Story = {
  args: {
    variant: 'default',
    classicon: 'i-carbon:checkmark',
  },
  render: args => ({
    components: { TagStatic },
    setup() {
      return { args }
    },
    template: '<TagStatic v-bind="args">v1.0.0</TagStatic>',
  }),
}
