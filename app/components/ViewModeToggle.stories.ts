import type { Meta, StoryObj } from '@nuxtjs/storybook'
import { ref } from 'vue'
import ViewModeToggle from './ViewModeToggle.vue'

const meta = {
  component: ViewModeToggle,
} satisfies Meta<typeof ViewModeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => ({
    components: { ViewModeToggle },
    setup() {
      const viewMode = ref('cards')
      return { viewMode }
    },
    template: `
      <div>
        <ViewModeToggle v-model="viewMode" />
        <p>
          Current mode: <strong>{{ viewMode }}</strong>
        </p>
      </div>
    `,
  }),
}
