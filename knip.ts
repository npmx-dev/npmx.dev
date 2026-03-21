import type { KnipConfig } from 'knip'

const config: KnipConfig = {
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
      ignoreDependencies: [
        '@iconify-json/*',
        'puppeteer',
        /** Needs to be explicitly installed, even though it is not imported, to avoid type errors. */
        'unplugin-vue-router',
        'vite-plugin-pwa',
        '@vueuse/shared',

        /** Some components import types from here, but installing it directly could lead to a version mismatch */
        'vue-router',

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
        '**/*.unused.*',
      ],
    },
    'cli': {
      project: ['src/**/*.ts!', '!src/mock-*.ts'],
    },
    'docs': {
      entry: ['app/**/*.{ts,vue,css}'],
      ignoreDependencies: ['@nuxtjs/mdc'],
    },
  },
}

export default config
