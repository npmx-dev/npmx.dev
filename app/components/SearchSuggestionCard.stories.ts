import type { Meta, StoryObj } from '@nuxtjs/storybook'
import SearchSuggestionCard from './SearchSuggestionCard.vue'

const meta = {
  component: SearchSuggestionCard,
  argTypes: {
    type: {
      control: 'select',
      options: ['user', 'org'],
    },
  },
} satisfies Meta<typeof SearchSuggestionCard>

export default meta
type Story = StoryObj<typeof meta>

export const User: Story = {
  args: {
    type: 'user',
    name: 'janedoe',
    isExactMatch: false,
  },
}

export const UserExactMatch: Story = {
  args: {
    ...User.args,
    isExactMatch: true,
  },
}

export const Organization: Story = {
  args: {
    type: 'org',
    name: 'vue',
    isExactMatch: false,
  },
}

export const OrganizationExactMatch: Story = {
  args: {
    ...Organization.args,
    isExactMatch: true,
  },
}
