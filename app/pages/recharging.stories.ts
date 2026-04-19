import Recharging from './recharging.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'
import { repoStatsHandler } from '../../.storybook/handlers'

const meta = {
  component: Recharging,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [repoStatsHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Recharging>

export default meta
type Story = StoryObj<typeof meta>

/** `/api/repo-stats` is intercepted by MSW so the three-column stats grid (contributors, commits, pull requests) is visible. */
export const Default: Story = {}

/** Stats grid is hidden with no API response; the rest of the page renders normally. */
export const WithoutStats: Story = {
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
