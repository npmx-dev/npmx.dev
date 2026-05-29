import LikesLeaderboard from './likes.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { http, HttpResponse } from 'msw'
import { pageDecorator } from '../../../.storybook/decorators'
import {
  likesLeaderboardHandler,
  likesLeaderboardEntries,
} from '../../storybook/mocks/handlers/leaderboard-likes'

const meta = {
  component: LikesLeaderboard,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [likesLeaderboardHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof LikesLeaderboard>

export default meta
type Story = StoryObj<typeof meta>

/** Full leaderboard with 10 entries. The top three are displayed in a podium layout, with the remaining seven rendered as a ranked list below. */
export const Default: Story = {}

/** Exactly three entries returned — only the podium section is rendered, no remaining list below. */
export const PodiumOnly: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/leaderboard/likes', () =>
          HttpResponse.json(likesLeaderboardEntries.slice(0, 3)),
        ),
      ],
    },
  },
}

/** Unavailable card is shown with no API response; `useFetch` falls back to its `default: () => []`. */
export const WithoutEntries: Story = {
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
