import type { Preview } from '@nuxtjs/storybook'
import { currentLocales } from '../config/i18n'
import { fn } from 'storybook/test'
import { ACCENT_COLORS } from '../shared/utils/constants'

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

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  // Provides toolbars to switch things like theming and language
  globalTypes: {
    locale: {
      name: 'Locale',
      description: 'UI language',
      defaultValue: 'en-US',
      toolbar: {
        icon: 'globe',
        dynamicTitle: true,
        items: [
          // English is at the top so it's easier to reset to it
          { value: 'en-US', title: 'English (US)' },
          ...currentLocales
            .filter(locale => locale.code !== 'en-US')
            .map(locale => ({ value: locale.code, title: locale.name })),
        ],
      },
    },
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
    theme: {
      name: 'Theme',
      description: 'Color mode',
      defaultValue: 'dark',
      toolbar: {
        icon: 'moon',
        dynamicTitle: true,
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (story, context) => {
      const { locale, theme, accentColor } = context.globals as {
        locale: string
        theme: string
        accentColor?: string
      }

      // Set theme from globals
      document.documentElement.setAttribute('data-theme', theme)

      // Set accent color from globals
      if (accentColor) {
        document.documentElement.style.setProperty('--accent-color', `var(--swatch-${accentColor})`)
      } else {
        document.documentElement.style.removeProperty('--accent-color')
      }

      return {
        template: '<story />',
        // Set locale from globals
        created() {
          if (this.$i18n) {
            this.$i18n.setLocale(locale)
          }
        },
        updated() {
          if (this.$i18n) {
            this.$i18n.setLocale(locale)
          }
        },
      }
    },
  ],
}

export default preview
