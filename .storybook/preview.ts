import type { Preview } from '@storybook-vue/nuxt'
import { withThemeByDataAttribute } from '@storybook/addon-themes'
import { addons } from 'storybook/preview-api'
import { currentLocales } from '../config/i18n'
import { fn } from 'storybook/test'
import { ACCENT_COLORS } from '../shared/utils/constants'

import npmxDark from './theme'

// related: https://github.com/npmx-dev/npmx.dev/blob/1431d24be555bca5e1ae6264434d49ca15173c43/test/nuxt/setup.ts#L12-L26
// Stub Nuxt specific globals
// @ts-expect-error - dynamic global name
globalThis['__NUXT_COLOR_MODE__'] ??= {
  preference: 'system',
  value: 'dark',
  getColorScheme: fn(() => 'dark'),
  addColorScheme: fn(),
  removeColorScheme: fn(),
}
// @ts-expect-error - dynamic global name
globalThis.defineOgImageComponent = fn()

// Subscribe to locale changes from storybook-i18n addon (once, outside decorator)
let currentI18nInstance: any = null
addons.getChannel().on('LOCALE_CHANGED', (newLocale: string) => {
  currentI18nInstance?.setLocale(newLocale)
})

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      theme: npmxDark,
    },
  },
  initialGlobals: {
    locale: 'en-US',
    locales: currentLocales.reduce(
      (acc, locale) => {
        acc[locale.code] = locale.name
        return acc
      },
      {} as Record<string, string>,
    ),
  },
  // Provides toolbars to switch things like theming and language
  globalTypes: {
    accentColor: {
      name: 'Accent Color',
      description: 'Accent color',
      toolbar: {
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          ...Object.keys(ACCENT_COLORS.light).map(color => ({
            value: color,
            title: color.charAt(0).toUpperCase() + color.slice(1),
          })),
          { value: undefined, title: 'No Accent' },
        ],
      },
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        Light: 'light',
        Dark: 'dark',
      },
      defaultTheme: 'Dark',
      attributeName: 'data-theme',
    }),
    (story, context) => {
      const { accentColor, locale } = context.globals as {
        accentColor?: string
        locale?: string
      }

      // Set accent color from globals
      if (accentColor) {
        document.documentElement.style.setProperty('--accent-color', `var(--swatch-${accentColor})`)
      } else {
        document.documentElement.style.removeProperty('--accent-color')
      }

      return {
        template: '<story />',
        created() {
          // Store i18n instance for LOCALE_CHANGED events
          currentI18nInstance = this.$i18n

          // Set initial locale when component is created
          if (locale && this.$i18n) {
            this.$i18n.setLocale(locale)
          }
        },
      }
    },
  ],
}

export default preview
