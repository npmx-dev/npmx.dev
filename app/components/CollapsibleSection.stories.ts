import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import CollapsibleSection from './CollapsibleSection.vue'

const meta = {
  component: CollapsibleSection,
  tags: ['autodocs'],
  args: {
    id: 'demo-section',
    title: 'Dependencies',
  },
  render: args => ({
    components: { CollapsibleSection },
    setup() {
      return { args }
    },
    template: `
      <CollapsibleSection v-bind="args">
        <ul class="text-sm text-fg-muted list-disc ps-4 space-y-1">
          <li>vue@3.4.0</li>
          <li>vue-router@4.2.0</li>
          <li>pinia@2.1.0</li>
        </ul>
      </CollapsibleSection>
    `,
  }),
} satisfies Meta<typeof CollapsibleSection>

export default meta
type Story = StoryObj<typeof meta>

/** Expanded section with a heading, anchor link and collapse toggle. */
export const Default: Story = {}

/** A secondary line of context beneath the title. */
export const WithSubtitle: Story = {
  args: {
    id: 'demo-section-subtitle',
    subtitle: '3 direct dependencies',
  },
}

/** Spinner in place of the chevron while content is being fetched. */
export const Loading: Story = {
  args: {
    id: 'demo-section-loading',
    isLoading: true,
  },
}

/** The `actions` slot renders controls on the right of the header. */
export const WithActions: Story = {
  render: args => ({
    components: { CollapsibleSection },
    setup() {
      return { args }
    },
    template: `
      <CollapsibleSection v-bind="args">
        <template #actions>
          <button class="text-xs font-mono text-fg-muted hover:text-fg">Expand all</button>
        </template>
        <p class="text-sm text-fg-muted">Section body content.</p>
      </CollapsibleSection>
    `,
  }),
  args: {
    id: 'demo-section-actions',
  },
}
