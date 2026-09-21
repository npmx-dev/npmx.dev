import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { fn } from 'storybook/test'
import CopyToClipboardButton from './CopyToClipboardButton.vue'

const meta = {
  component: CopyToClipboardButton,
  tags: ['autodocs'],
  args: {
    copied: false,
    onClick: fn(),
  },
  render: args => ({
    components: { CopyToClipboardButton },
    setup() {
      return { args }
    },
    template: `
      <CopyToClipboardButton v-bind="args">
        <code class="font-mono text-sm px-2 py-1 rounded bg-bg-subtle border border-border">npm install example-package</code>
      </CopyToClipboardButton>
    `,
  }),
} satisfies Meta<typeof CopyToClipboardButton>

export default meta
type Story = StoryObj<typeof meta>

/**
 * The copy button is visually hidden until you hover (or focus) the wrapped
 * content, then slides in beneath it. Hover the code below to reveal it.
 */
export const Default: Story = {}

/** The "copied" confirmation state, shown after a successful copy. */
export const Copied: Story = {
  args: {
    copied: true,
  },
}

/** Custom labels for both the idle and copied states. */
export const CustomLabels: Story = {
  args: {
    copyText: 'Copy command',
    copiedText: 'Copied!',
  },
}
