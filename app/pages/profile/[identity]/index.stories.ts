import Profile from './index.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { expect, userEvent } from 'storybook/test'
import { pageDecorator } from '../../../../.storybook/decorators'
import {
  mockAuthSessionHandler,
  mockPackageLikesHandler,
  mockProfile,
  mockProfileHandle,
  mockProfileHandler,
  mockProfileLikesHandler,
  mockUpdateProfileHandler,
} from '../../../storybook/mocks/handlers/profile'
import { renderPageAt } from '../../../storybook/render-page'

const PROFILE_PATH = `/profile/${mockProfileHandle}`

const meta = {
  component: Profile,

  render: renderPageAt(Profile, PROFILE_PATH),

  beforeEach({ msw }) {
    msw.use(
      mockProfileHandler(),
      mockProfileLikesHandler(),
      mockPackageLikesHandler,
      mockAuthSessionHandler(),
      mockUpdateProfileHandler,
    )
  },

  parameters: {
    layout: 'fullscreen',
  },

  decorators: [pageDecorator],
} satisfies Meta<typeof Profile>

export default meta
type Story = StoryObj<typeof meta>

/** Public profile with profile metadata and several liked packages. */
export const Default: Story = {}

/** Authenticated as the profile owner so the edit action is available. */
export const Owner: Story = {
  beforeEach({ msw }) {
    msw.use(mockAuthSessionHandler(mockProfileHandle))
  },
}

/** Owner profile with the edit form opened and its editable controls visible. */
export const Editing: Story = {
  ...Owner,
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /edit/i }))

    await expect(canvas.getByText(/display name/i)).toBeVisible()
    await expect(await canvas.findByDisplayValue(mockProfile.displayName)).toBeVisible()
    await expect(canvas.getByText(/description/i)).toBeVisible()
    await expect(canvas.getByDisplayValue(mockProfile.description ?? '')).toBeVisible()
    await expect(canvas.getByText(/website/i)).toBeVisible()
    await expect(canvas.getByDisplayValue(mockProfile.website ?? '')).toBeVisible()
    await expect(canvas.getByRole('button', { name: /cancel/i })).toBeVisible()
    await expect(canvas.getByRole('button', { name: /save/i })).toBeVisible()
  },
}

/** Missing npmx profile record with no likes; authenticated as another user so the invite section appears. */
export const Invite: Story = {
  beforeEach({ msw }) {
    msw.use(
      mockProfileHandler({ recordExists: false }),
      mockProfileLikesHandler([]),
      mockAuthSessionHandler('other-user.test'),
    )
  },
}

/** Existing profile with no liked packages and no invite section. */
export const WithoutLikes: Story = {
  beforeEach({ msw }) {
    msw.use(mockProfileLikesHandler([]))
  },
}
