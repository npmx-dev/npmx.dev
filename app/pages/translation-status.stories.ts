import TranslationStatus from './translation-status.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { pageDecorator } from '../../.storybook/decorators'
import { i18nStatusHandler } from '../storybook/mocks/handlers/lunaria-status'

const meta = {
  component: TranslationStatus,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [i18nStatusHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof TranslationStatus>

export default meta
type Story = StoryObj<typeof meta>

/** `/lunaria/status.json` is intercepted by MSW. Showing a variety of completion level translation statuses for a subset of locales. */
export const Default: Story = {}

/** No API response — the fetch never succeeds so `fetchStatus` stays as `'pending'`. Shows skeleton blocks in the locale list and skeleton inlines in body text. */
export const WithoutTranslationData: Story = {
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
