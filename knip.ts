import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  treatConfigHintsAsErrors: true,
  treatTagHintsAsErrors: true,
  workspaces: {
    '.': {
      entry: [
        'i18n/**/*.ts',
        'lunaria.config.ts',
        'lunaria/lunaria.ts',
        'pwa-assets.config.ts',
        'modules/*.ts',
        '.lighthouserc.cjs',
        'lighthouse-setup.cjs',
        'uno-preset-*.ts!',
        'scripts/**/*.ts',
      ],
      project: [
        '**/*.{ts,vue,cjs,mjs}',
        '!test/fixtures/**',
        '!test/test-utils/**',
        '!test/e2e/helpers/**',
        '!cli/src/**',
        '!lexicons/**',
      ],
      msw: {
        entry: ['.storybook/.public/mockServiceWorker.js'],
      },
      ignoreDependencies: [
        '@iconify-json/*',
        'puppeteer',
        'vite-plugin-pwa',
        '@vueuse/shared',

        /** Oxlint plugins don't get picked up yet */
        '@e18e/eslint-plugin',
        'eslint-plugin-regexp',

        /** Used in test/e2e/helpers/ which is excluded from knip project scope */
        'h3-next',
      ],
      ignoreUnresolved: ['#oauth/config'],
      ignoreFiles: [
        'app/components/Tooltip/Announce.vue',
        'app/components/UserCombobox.vue',
        'app/components/ColorScheme/Img.vue',
        '**/*.unused.*',
      ],
    },
    'cli': {
      project: ['src/**/*.ts!', '!src/mock-*.ts'],
    },
    'docs': {
      entry: ['app/**/*.{ts,vue,css}', 'shared/**/*.{ts,vue,css}'],
      project: ['**/*.{ts,vue,cjs,mjs}'],
      ignoreDependencies: ['@nuxtjs/mdc'],
    },
  },
}

export default config
