import About from './about.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'
import { contributorsHandler } from '../../.storybook/handlers'

const meta = {
  component: About,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [contributorsHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof About>

export default meta
type Story = StoryObj<typeof meta>

/** `/api/contributors` is intercepted by MSW so both governance members and community contributors sections are populated. */
export const Default: Story = {}

/** Contributors section is hidden with no API response. */
export const WithoutContributors: Story = {
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
