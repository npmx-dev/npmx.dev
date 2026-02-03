import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  workspaces: {
    '.': {
      entry: [
        'app/app.vue!',
        'app/error.vue!',
        'app/pages/**/*.vue!',
        'app/components/**/*.vue!',
        'app/composables/**/*.ts!',
        'app/middleware/**/*.ts!',
        'app/plugins/**/*.ts!',
        'app/utils/**/*.ts!',
        'server/**/*.ts!',
        'modules/**/*.ts!',
        'config/**/*.ts!',
        'lunaria/**/*.ts!',
        'shared/**/*.ts!',
        'i18n/**/*.ts',
        'lunaria.config.ts',
        'pwa-assets.config.ts',
        '.lighthouserc.cjs',
        'lighthouse-setup.cjs',
        'uno-preset-rtl.ts!',
        'scripts/**/*.ts',
      ],
      project: ['**/*.{ts,vue,cjs,mjs}'],
      ignoreDependencies: [
        '@iconify-json/*',
        '@vercel/kv',
        '@voidzero-dev/vite-plus-core',
        'vite-plus!',
        'h3',
        /** Needs to be explicitly installed, even though it is not imported, to avoid type errors. */
        'unplugin-vue-router',
        'vite-plugin-pwa',

        /** Some components import types from here, but installing it directly could lead to a version mismatch */
        'vue-router',
      ],
      ignoreUnresolved: ['#components', '#oauth/config'],
    },
    'cli': {
      project: ['src/**/*.ts!'],
    },
    'docs': {
      entry: ['app/**/*.{ts,vue}'],
      ignoreDependencies: ['docus', 'better-sqlite3', 'nuxt!'],
    },
  },
}

export default config
