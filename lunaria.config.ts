import { defineConfig } from '@lunariajs/core/config'

export default defineConfig({
  repository: {
    name: 'npmx-dev/npmx.dev',
  },
  sourceLocale: {
    label: 'English',
    lang: 'en',
  },
  locales: [
    {
      label: 'Français',
      lang: 'fr',
    },
    {
      label: 'Italiano',
      lang: 'it',
    },
    {
      label: '简体中文',
      lang: 'zh-CN',
    },
  ],
  files: [
    {
      include: ['i18n/locales/en.json'],
      pattern: 'i18n/locales/@lang.json',
      type: 'dictionary',
    },
  ],
  tracking: {
    ignoredKeywords: [
      'lunaria-ignore',
      'typo',
      'en-only',
      'broken link',
      'i18nReady',
      'i18nIgnore',
    ],
  },
})
