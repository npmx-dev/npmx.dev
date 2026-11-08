import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import ItemList from './ItemList.vue'
import { mockCollection } from '../../storybook/mocks/handlers/collections'

const meta = {
  component: ItemList,
  tags: ['autodocs'],
  args: { items: mockCollection.items },
  decorators: [() => ({ template: '<div class="max-w-2xl"><story /></div>' })],
} satisfies Meta<typeof ItemList>

export default meta
type Story = StoryObj<typeof meta>

/** Packages with notes, a package missing from the registry, and a nested collection. */
export const Default: Story = {}

/** An included collection that can't be shown. */
export const UnavailableCollection: Story = {
  args: {
    items: [
      {
        kind: 'collection',
        subjectRef: 'at://did:plc:x/dev.npmx.collection/3m5k5baifas2z',
        collection: null,
        unavailableReason: 'unresolvable',
      },
    ],
  },
}

/** Items written by other clients that we don't understand. */
export const UnknownItems: Story = {
  args: {
    items: [
      { kind: 'unknown', subjectRef: 'https://www.npmjs.com/package/zod', note: 'Wrong URL' },
    ],
  },
}
