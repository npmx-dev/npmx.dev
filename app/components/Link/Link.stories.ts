import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LinkBase from './Base.vue'

const meta = {
  component: LinkBase,
  args: {
    to: '/',
    default: 'Click me',
  },
} satisfies Meta<typeof LinkBase>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ExternalLink: Story = {
  args: {
    to: 'https://example.com',
    default: 'External Link',
  },
}

export const AnchorLink: Story = {
  args: {
    to: '#section',
    default: 'Anchor Link',
  },
}

export const WithIcon: Story = {
  args: {
    classicon: 'i-lucide:check',
    default: 'Verified',
  },
}

export const NoUnderline: Story = {
  args: {
    noUnderline: true,
    default: 'Link without underline',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    default: 'Disabled Link',
  },
}

export const ButtonPrimary: Story = {
  args: {
    variant: 'button-primary',
    default: 'Primary Button',
  },
}

export const ButtonSecondary: Story = {
  args: {
    variant: 'button-secondary',
    default: 'Secondary Button',
  },
}

export const SmallButton: Story = {
  args: {
    variant: 'button-primary',
    size: 'small',
    default: 'Small Button',
  },
}

export const WithIconButton: Story = {
  args: {
    variant: 'button-primary',
    classicon: 'i-lucide:copy',
    default: 'Copy',
  },
}

export const WithKeyboardShortcut: Story = {
  args: {
    variant: 'button-secondary',
    ariaKeyshortcuts: 's',
    default: 'Search',
  },
}

export const BlockLink: Story = {
  args: {
    variant: 'button-primary',
    block: true,
    default: 'Full Width Button',
  },
}

export const DisabledButton: Story = {
  args: {
    variant: 'button-primary',
    disabled: true,
    default: 'Disabled Button',
  },
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
          <LinkBase to="/" variant="button-primary" size="small">Small Button</LinkBase>
        </div>
        <LinkBase to="/" variant="button-primary" block>Full Width Button</LinkBase>
      </div>
    `,
    components: { LinkBase },
  }),
}
