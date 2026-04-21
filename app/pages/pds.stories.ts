import Pds from './pds.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'
import { pdsUsersHandler } from '../storybook/mocks/handlers'

const meta = {
  component: Pds,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [pdsUsersHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Pds>

export default meta
type Story = StoryObj<typeof meta>

/** `/api/atproto/pds-users` is intercepted by MSW so the community section displays both avatar images and text-only entries. */
export const Default: Story = {}

/** Community section shows an empty/loading state with no API response. */
export const WithoutUsers: Story = {
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
