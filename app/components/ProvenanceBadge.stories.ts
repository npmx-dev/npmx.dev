import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ProvenanceBadge from './ProvenanceBadge.vue'

const meta = {
  component: ProvenanceBadge,
  tags: ['autodocs'],
  args: {
    packageName: 'example-package',
    version: '1.0.0',
  },
} satisfies Meta<typeof ProvenanceBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Links to the npm provenance page when a package name and version are given. */
export const Default: Story = {}

/** Icon-only variant for tight spaces. */
export const Compact: Story = {
  args: {
    compact: true,
  },
}

/** Rendered as static text (no link) when `linked` is false. */
export const NotLinked: Story = {
  args: {
    linked: false,
  },
}
