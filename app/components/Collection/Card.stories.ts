import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Card from './Card.vue'
import { mockCollectionSummary } from '../../storybook/mocks/handlers/collections'

const meta = {
  component: Card,
  tags: ['autodocs'],
  args: { collection: mockCollectionSummary },
  decorators: [() => ({ template: '<div class="max-w-sm"><story /></div>' })],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** Collections from allowlisted accounts, such as npmx's own, get a badge. */
export const Curated: Story = {
  args: {
    collection: {
      ...mockCollectionSummary,
      did: 'did:plc:u5zp7npt5kpueado77kuihyz',
      handle: 'npmx.dev',
    },
  },
}

export const WithoutDescription: Story = {
  args: { collection: { ...mockCollectionSummary, description: undefined } },
}
