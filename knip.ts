import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
  workspaces: {
    '.': {
      entry: [
        'i18n/**/*.ts',
        'lunaria.config.ts',
        'modules/*.ts',
        '.lighthouserc.cjs',
        'lighthouse-setup.cjs',
        'uno-preset-*.ts!',
        'scripts/**/*.ts',
        '{*,.github/*,app/pages/blog/**}.md',
      ],
      project: [
        '**/*.{ts,vue,cjs,mjs,md,mdx}',
        '!test/fixtures/**',
        '!test/test-utils/**',
        '!test/e2e/helpers/**',
        '!cli/src/**',
        '!lexicons/**',
      ],
      msw: {
        entry: ['.storybook/.public/mockServiceWorker.js'],
      },
      ignoreDependencies: ['@iconify-json/*', 'puppeteer', 'vite-plugin-pwa', '@vueuse/shared'],
      ignoreUnresolved: ['#oauth/config'],
      ignoreFiles: ['app/components/UserCombobox.vue', '**/*.unused.*'],
    },
    'cli': {
      project: ['src/**/*.ts!', '!src/mock-*.ts'],
    },
    'docs': {
      entry: ['app/**/*.{ts,vue,css}', 'shared/**/*.{ts,vue,css}'],
      project: ['**/*.{ts,vue,cjs,mjs,css}'],
      ignoreDependencies: ['@nuxtjs/mdc'],
    },
  },
}

export default config
