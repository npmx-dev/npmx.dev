import Settings from './settings.vue'
import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { userEvent, expect } from 'storybook/test'
import { pageDecorator } from '../../.storybook/decorators'
import { i18nStatusHandler } from '../storybook/mocks/handlers/lunaria-status'

const meta = {
  component: Settings,
  globals: {
    locale: 'en-US',
  },
  beforeEach: () => localStorage.removeItem('npmx-settings'),
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [i18nStatusHandler],
    },
  },
  decorators: [pageDecorator],
} satisfies Meta<typeof Settings>

export default meta
type Story = StoryObj<typeof meta>

/** English locale (default). The Language section shows a GitHub link to help translate the site. */
export const Default: Story = {}

export const NpmRegistryDataSource: Story = {
  play: async ({ canvas, step }) => {
    await step('Select npm registry as the data source', async () => {
      const select = await canvas.findByRole('combobox', { name: /data source/i })
      await userEvent.selectOptions(select, 'npm')
      await expect(select).toHaveValue('npm')
    })
  },
}

/** Non-English locale with incomplete translations. The Language section shows `SettingsTranslationHelper` with a progress bar and list of missing translation keys. `/lunaria/status.json` is intercepted by MSW to provide mock translation status data. */
export const NonEnglishTranslationHelper: Story = {
  globals: {
    locale: 'fr-FR',
  },
}

/** Non-English locale without translations API response. The Language section shows a GitHub link to help translate the site. */
export const WithoutTranslationHelper: Story = {
  globals: {
    locale: 'fr-FR',
  },
  parameters: {
    msw: {
      handlers: [],
    },
  },
}
