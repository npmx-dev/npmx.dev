import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ButtonBase from './Base.vue'
import ButtonGroup from './Group.vue'

const meta = {
  component: ButtonBase,
  subcomponents: { ButtonGroup },
  parameters: {
    docs: {
      source: {
        type: 'dynamic',
        transform: (code: string) =>
          code.replace(/<Base\b/g, '<ButtonBase').replace(/<\/Base>/g, '</ButtonBase>'),
      },
    },
  },
  render: args => ({
    components: { ButtonBase },
    setup() {
      return { args }
    },
    template: `<ButtonBase v-bind="args">{{ $t("nav.settings") }}</ButtonBase>`,
  }),
  tags: ['autodocs'],
} satisfies Meta<typeof ButtonBase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
}

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
}

export const Small: Story = {
  args: {
    size: 'small',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
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
}

export const GroupedButtons: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Use `ButtonGroup` to group multiple buttons together with connected borders.',
      },
      source: {
        code: `<template>
  <ButtonGroup>
    <ButtonBase>Back</ButtonBase>
    <ButtonBase>Settings</ButtonBase>
    <ButtonBase>Compare</ButtonBase>
  </ButtonGroup>
</template>`,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase>{{ $t('nav.back') }}</ButtonBase>
        <ButtonBase>{{ $t('nav.settings') }}</ButtonBase>
        <ButtonBase>{{ $t('nav.compare') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}

export const GroupedWithVariants: Story = {
  parameters: {
    docs: {
      source: {
        code: `<template>
  <ButtonGroup>
    <ButtonBase variant="primary">Back</ButtonBase>
    <ButtonBase variant="primary">Settings</ButtonBase>
    <ButtonBase variant="primary">Compare</ButtonBase>
  </ButtonGroup>
</template>`,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase variant="primary">{{ $t('nav.back') }}</ButtonBase>
        <ButtonBase variant="primary">{{ $t('nav.settings') }}</ButtonBase>
        <ButtonBase variant="primary">{{ $t('nav.compare') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}

export const GroupedWithIcons: Story = {
  parameters: {
    docs: {
      source: {
        code: `<template>
  <ButtonGroup>
    <ButtonBase variant="secondary" classicon="i-lucide:search">Search</ButtonBase>
    <ButtonBase variant="secondary" classicon="i-lucide:x">Back</ButtonBase>
  </ButtonGroup>
</template>`,
      },
    },
  },
  render: () => ({
    components: { ButtonBase, ButtonGroup },
    template: `
      <ButtonGroup>
        <ButtonBase variant="secondary" classicon="i-lucide:search">{{ $t('search.button') }}</ButtonBase>
        <ButtonBase variant="secondary" classicon="i-lucide:x">{{ $t('nav.back') }}</ButtonBase>
      </ButtonGroup>
    `,
  }),
}
