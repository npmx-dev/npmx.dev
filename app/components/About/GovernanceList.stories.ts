import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import type { GitHubContributor } from '~~/server/api/contributors.get'
import GovernanceList from './GovernanceList.vue'

const members: GitHubContributor[] = [
  {
    login: 'mock-steward-a',
    id: 1001,
    avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=steward-a',
    html_url: 'https://github.com/mock-steward-a',
    contributions: 2800,
    role: 'steward',
    sponsors_url: 'https://github.com/sponsors/',
  },
  {
    login: 'mock-core-a',
    id: 1003,
    avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=core-a',
    html_url: 'https://github.com/mock-core-a',
    contributions: 9000,
    role: 'core',
    sponsors_url: null,
  },
  {
    login: 'mock-maintainer-a',
    id: 1004,
    avatar_url: 'https://api.dicebear.com/9.x/initials/svg?seed=maintainer-a',
    html_url: 'https://github.com/mock-maintainer-a',
    contributions: 210,
    role: 'maintainer',
    sponsors_url: null,
  },
]

const meta = {
  component: GovernanceList,
  tags: ['autodocs'],
  args: {
    members,
  },
} satisfies Meta<typeof GovernanceList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** A single member with a sponsor link. */
export const SingleMember: Story = {
  args: {
    members: [members[0]!],
  },
}

/** No members returned — renders an empty grid. */
export const Empty: Story = {
  args: {
    members: [],
  },
}
