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
  beforeEach({ msw }) {
    localStorage.removeItem('npmx-settings')
    msw.use(i18nStatusHandler)
  },
  parameters: {
    layout: 'fullscreen',
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

/** Disabling every security data source surfaces the "no security data source is enabled" warning. */
export const NoSecuritySourcesWarning: Story = {
  play: async ({ canvas, step }) => {
    await step('Disable the OSV security data source', async () => {
      const toggle = await canvas.findByRole('switch', { name: /osv/i })
      await expect(toggle).toBeChecked()
      await userEvent.click(toggle)
      await expect(toggle).not.toBeChecked()
    })

    await step('The no-sources warning appears', async () => {
      const warning = await canvas.findByRole('alert')
      await expect(warning).toHaveTextContent(/no security data source is enabled/i)
    })

    await step('Re-enabling a source dismisses the warning', async () => {
      const toggle = await canvas.findByRole('switch', { name: /osv/i })
      await userEvent.click(toggle)
      await expect(toggle).toBeChecked()
      await expect(canvas.queryByRole('alert')).not.toBeInTheDocument()
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
}
