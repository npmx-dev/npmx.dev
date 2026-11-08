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

export const WithoutDescription: Story = {
  args: { collection: { ...mockCollectionSummary, description: undefined } },
}
