import CollectionPage from './[rkey].vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../../../.storybook/decorators'
import {
  mockCollectionHandle,
  mockCollectionHandler,
  mockCollectionRkey,
} from '../../../storybook/mocks/handlers/collections'
import { mockAuthSessionHandler } from '../../../storybook/mocks/handlers/profile'
import { renderPageAt } from '../../../storybook/render-page'

const meta = {
  component: CollectionPage,
  render: renderPageAt(
    CollectionPage,
    `/collections/${mockCollectionHandle}/${mockCollectionRkey}`,
  ),
  beforeEach({ msw }) {
    msw.use(mockCollectionHandler, mockAuthSessionHandler())
  },
  parameters: { layout: 'fullscreen' },
  decorators: [pageDecorator],
} satisfies Meta<typeof CollectionPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The owner can edit and delete. */
export const Owner: Story = {
  beforeEach({ msw }) {
    msw.use(mockAuthSessionHandler(mockCollectionHandle))
  },
}
