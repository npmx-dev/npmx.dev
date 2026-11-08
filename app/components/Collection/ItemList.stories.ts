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

/** Packages with notes, a package missing from the registry, a nested collection, and a hidden one. */
export const Default: Story = {}

/** Every reason an included collection can't be shown. */
export const UnavailableCollections: Story = {
  args: {
    items: (['unresolvable', 'hidden'] as const).map(reason => ({
      kind: 'collection' as const,
      subjectRef: `at://did:plc:x/dev.npmx.collection/${reason}`,
      collection: null,
      unavailableReason: reason,
    })),
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
