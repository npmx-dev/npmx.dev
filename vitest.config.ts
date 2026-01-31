import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { playwright } from '@vitest/browser-playwright'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '#shared': `${rootDir}/shared`,
          },
        },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          setupFiles: ['./test/nuxt/setup.ts'],
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              overrides: {
                experimental: {
                  viteEnvironmentApi: false,
                },
                ogImage: { enabled: false },
              },
            },
          },
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      }),
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      // Exclude files that cause parse errors during coverage remapping.
      // The V8 coverage provider uses rolldown to parse source files, but
      // rolldown seems to currently fail on Vite's SSR transform output (`await __vite_ssr_import__`).
      exclude: [
        '**/node_modules/**',
        'cli/**',
        'app/utils/versions.ts',
        'app/utils/package-name.ts',
        'shared/utils/git-providers.ts',
        'shared/utils/spdx.ts',
        'shared/utils/url.ts',
        'server/utils/readme.ts',
        'server/utils/docs/text.ts',
        'server/utils/code-highlight.ts',
        'server/utils/npm.ts',
        'server/utils/shiki.ts',
        'server/utils/jsr.ts',
      ],
    },
  },
})
