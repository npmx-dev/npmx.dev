import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ButtonBase from './Base.vue'

const meta = {
  component: ButtonBase,
  parameters: {
    docs: {
      source: {
        type: 'dynamic',
        transform: (code: string) =>
          code.replace(/<Base\b/g, '<ButtonBase').replace(/<\/Base>/g, '</ButtonBase>'),
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonBase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    default: 'Button Text',
  },
}

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
}

export const Small: Story = {
  args: {
    size: 'small',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
}

export const WithIcon: Story = {
  args: {
    classicon: 'i-lucide:search',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("search.button") }}</ButtonBase>`,
  }),
}

export const WithKeyboardShortcut: Story = {
  args: {
    ariaKeyshortcuts: '/',
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("search.button") }}</ButtonBase>`,
  }),
}

export const Block: Story = {
  args: {
    block: true,
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
}
