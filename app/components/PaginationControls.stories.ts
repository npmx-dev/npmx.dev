import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { ref } from 'vue'
import PaginationControls from './PaginationControls.vue'

const meta = {
  component: PaginationControls,
  tags: ['autodocs'],
  args: {
    totalItems: 1240,
    mode: 'paginated',
    pageSize: 25,
    currentPage: 3,
  },
  // The component is driven by v-model, so seed local state from the args and
  // bind the remaining props explicitly.
  render: args => ({
    components: { PaginationControls },
    setup() {
      const mode = ref(args.mode)
      const pageSize = ref(args.pageSize)
      const currentPage = ref(args.currentPage)

      watch(
        () => args.mode,
        value => {
          mode.value = value
        },
      )
      watch(
        () => args.pageSize,
        value => {
          pageSize.value = value
        },
      )
      watch(
        () => args.currentPage,
        value => {
          currentPage.value = value
        },
      )

      return { args, mode, pageSize, currentPage }
    },
    template: `
      <PaginationControls
        :total-items="args.totalItems"
        :view-mode="args.viewMode"
        v-model:mode="mode"
        v-model:page-size="pageSize"
        v-model:current-page="currentPage"
      />
    `,
  }),
} satisfies Meta<typeof PaginationControls>

export default meta
type Story = StoryObj<typeof meta>

/** Paginated mode with a page-size select, item range and page navigation. */
export const Default: Story = {}

/** In table view the mode toggle is hidden — tables always paginate. */
export const TableView: Story = {
  args: {
    viewMode: 'table',
  },
}

/** Few enough items that every page number is shown (no ellipsis). */
export const FewPages: Story = {
  args: {
    totalItems: 60,
  },
}
