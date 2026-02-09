import { defineConfig } from '@lunariajs/core/config'
import { locales, sourceLocale } from './lunaria/prepare-json-files.ts'

export default defineConfig({
  repository: {
    name: 'npmx-dev/npmx.dev',
  },
  sourceLocale,
  locales,
  files: [
    {
      include: ['lunaria/files/en-US.json'],
      pattern: 'lunaria/files/@lang.json',
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
