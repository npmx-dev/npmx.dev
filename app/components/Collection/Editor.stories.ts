import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { expect, userEvent } from 'storybook/test'
import Editor from './Editor.vue'
import { mockCollection } from '../../storybook/mocks/handlers/collections'

const meta = {
  component: Editor,
  tags: ['autodocs'],
  decorators: [() => ({ template: '<div class="max-w-2xl"><story /></div>' })],
} satisfies Meta<typeof Editor>

export default meta
type Story = StoryObj<typeof meta>

/** Creating a new collection. */
export const Empty: Story = {}

/** Editing an existing collection. */
export const Editing: Story = {
  args: { initial: mockCollection },
}

/** The collection changed elsewhere while it was open. */
export const Conflict: Story = {
  args: {
    ...Editing.args,
    errorMessage:
      'This collection was changed somewhere else since you opened it. Reload to get the latest version.',
  },
}

/** Adding a package by name and reordering it to the top. */
export const AddAndReorder: Story = {
  args: Editing.args,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('combobox', { name: /add a package/i }), 'zod{enter}')
    // Only added items have this; text matching can hit a typeahead suggestion that then closes
    const moveUp = await canvas.findByRole('button', { name: /move zod up/i })
    await userEvent.click(moveUp)
    await expect(canvas.getByRole('button', { name: /move zod down/i })).toBeVisible()
  },
}
