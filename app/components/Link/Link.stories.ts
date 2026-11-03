import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LinkBase from './Base.vue'

const meta = {
  component: LinkBase,
  tags: ['autodocs'],
  args: {
    to: '/',
  },
} satisfies Meta<typeof LinkBase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Click me</LinkBase>`,
  }),
}

export const ExternalLink: Story = {
  args: {
    to: 'https://example.com',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">External Link</LinkBase>`,
  }),
}

export const AnchorLink: Story = {
  args: {
    to: '#section',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Anchor Link</LinkBase>`,
  }),
}

export const WithIcon: Story = {
  args: {
    classicon: 'i-lucide:check',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Verified</LinkBase>`,
  }),
}

export const NoUnderline: Story = {
  args: {
    noUnderline: true,
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Link without underline</LinkBase>`,
  }),
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Disabled Link</LinkBase>`,
  }),
}

export const ButtonPrimary: Story = {
  args: {
    variant: 'button-primary',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Primary Button</LinkBase>`,
  }),
}

export const ButtonSecondary: Story = {
  args: {
    variant: 'button-secondary',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Secondary Button</LinkBase>`,
  }),
}

export const SmallButton: Story = {
  args: {
    variant: 'button-primary',
    size: 'sm',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Small Button</LinkBase>`,
  }),
}

export const WithIconButton: Story = {
  args: {
    variant: 'button-primary',
    classicon: 'i-lucide:copy',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">{{ $t("package.readme.copy_as_markdown") }}</LinkBase>`,
  }),
}

export const WithKeyboardShortcut: Story = {
  args: {
    variant: 'button-secondary',
    ariaKeyshortcuts: 's',
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">{{ $t("search.button") }}</LinkBase>`,
  }),
}

export const BlockLink: Story = {
  args: {
    variant: 'button-primary',
    block: true,
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Full Width Button</LinkBase>`,
  }),
}

export const DisabledButton: Story = {
  args: {
    variant: 'button-primary',
    disabled: true,
  },
  render: args => ({
    components: { LinkBase },
    setup() {
      return { args }
    },
    template: `<LinkBase v-bind="args">Disabled Button</LinkBase>`,
  }),
}

export const Snapshot: Story = {
  render: () => ({
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem; padding: 1rem;">
        <LinkBase to="/">Default Link</LinkBase>
        <LinkBase to="https://example.com">External Link</LinkBase>
        <LinkBase to="#section">Anchor Link</LinkBase>
        <LinkBase to="/" classicon="i-lucide:check">Link with icon</LinkBase>
        <LinkBase to="/" no-underline>Link without underline</LinkBase>
        <LinkBase to="/" disabled>Disabled Link</LinkBase>

        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <LinkBase to="/" variant="button-primary">Primary</LinkBase>
          <LinkBase to="/" variant="button-secondary">Secondary</LinkBase>
          <LinkBase to="/" variant="button-primary" disabled>Disabled</LinkBase>
          <LinkBase to="/" variant="button-primary" classicon="i-lucide:copy">With Icon</LinkBase>
        </div>

        <div style="display: flex; gap: 1rem;">
          <LinkBase to="/" variant="button-primary" size="sm">Small Button</LinkBase>
        </div>
        <LinkBase to="/" variant="button-primary" block>Full Width Button</LinkBase>
      </div>
    `,
    components: { LinkBase },
  }),
}
