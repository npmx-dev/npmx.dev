import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import TrustedPublishingBadge from './TrustedPublishingBadge.vue'

const meta = {
  component: TrustedPublishingBadge,
  tags: ['autodocs'],
  argTypes: {
    provider: {
      control: 'select',
      options: ['github', 'gitlab', undefined],
    },
  },
  args: {
    provider: 'github',
  },
} satisfies Meta<typeof TrustedPublishingBadge>

export default meta
type Story = StoryObj<typeof meta>

/** Links to the npm trusted publishing docs. */
export const Default: Story = {}

/** Icon-only variant for tight spaces, as used on search result cards. */
export const Compact: Story = {
  args: {
    compact: true,
  },
}

/** Published from GitLab CI rather than GitHub Actions. */
export const GitLab: Story = {
  args: {
    provider: 'gitlab',
  },
}

/** Rendered as static text (no link) when `linked` is false. */
export const NotLinked: Story = {
  args: {
    linked: false,
  },
}

/** Without a provider, it shows a generic title. */
export const NoProvider: Story = {
  args: {
    provider: undefined,
  },
}
