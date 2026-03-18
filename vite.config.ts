import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite-plus'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { playwright } from 'vite-plus/test/browser-playwright'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  run: {
    tasks: {
      'lint': {
        command: 'vp lint && vp fmt --check',
      },
      'knip': {
        command: 'knip',
      },
      'generate:lexicons': {
        command: 'lex build --lexicons lexicons --out shared/types/lexicons --clear',
      },
      'generate:sprite': {
        command: 'node scripts/generate-file-tree-sprite.ts',
      },
      'i18n:check': {
        command: 'node scripts/compare-translations.ts',
      },
      'i18n:report': {
        command: 'node scripts/find-invalid-translations.ts',
      },
      'i18n:schema': {
        command: 'node scripts/generate-i18n-schema.ts',
      },
      'lint:css': {
        command: 'node scripts/unocss-checker.ts',
      },
      'build:lunaria': {
        command: 'node ./lunaria/lunaria.ts',
      },
    },
  },
  lint: {
    plugins: ['unicorn', 'typescript', 'oxc', 'vue', 'vitest'],
    jsPlugins: ['@e18e/eslint-plugin', 'eslint-plugin-regexp'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      perf: 'warn',
    },
    rules: {
      'no-console': 'warn',
      'no-await-in-loop': 'off',
      'unicorn/no-array-sort': 'off',
      'no-restricted-globals': 'error',
      'typescript/consistent-type-imports': 'error',
      'e18e/prefer-array-from-map': 'error',
      'e18e/prefer-timer-args': 'error',
      'e18e/prefer-date-now': 'error',
      'e18e/prefer-regex-test': 'error',
      'e18e/prefer-array-some': 'error',
      // RegExp - Possible Errors
      'regexp/no-contradiction-with-assertion': 'error',
      'regexp/no-dupe-disjunctions': 'error',
      'regexp/no-empty-alternative': 'error',
      'regexp/no-empty-capturing-group': 'error',
      'regexp/no-empty-character-class': 'error',
      'regexp/no-empty-group': 'error',
      'regexp/no-empty-lookarounds-assertion': 'error',
      'regexp/no-escape-backspace': 'error',
      'regexp/no-invalid-regexp': 'error',
      'regexp/no-lazy-ends': 'error',
      'regexp/no-misleading-capturing-group': 'error',
      'regexp/no-misleading-unicode-character': 'error',
      'regexp/no-missing-g-flag': 'error',
      'regexp/no-optional-assertion': 'error',
      'regexp/no-potentially-useless-backreference': 'error',
      'regexp/no-super-linear-backtracking': 'error',
      'regexp/no-useless-assertions': 'error',
      'regexp/no-useless-backreference': 'error',
      'regexp/no-useless-dollar-replacements': 'error',
      'regexp/strict': 'error',
      // RegExp - Best Practices
      'regexp/confusing-quantifier': 'warn',
      'regexp/control-character-escape': 'error',
      'regexp/negation': 'error',
      'regexp/no-dupe-characters-character-class': 'error',
      'regexp/no-empty-string-literal': 'error',
      'regexp/no-extra-lookaround-assertions': 'error',
      'regexp/no-invisible-character': 'error',
      'regexp/no-legacy-features': 'error',
      'regexp/no-non-standard-flag': 'error',
      'regexp/no-obscure-range': 'error',
      'regexp/no-octal': 'error',
      'regexp/no-standalone-backslash': 'error',
      'regexp/no-trivially-nested-assertion': 'error',
      'regexp/no-trivially-nested-quantifier': 'error',
      'regexp/no-unused-capturing-group': 'warn',
      'regexp/no-useless-character-class': 'error',
      'regexp/no-useless-flag': 'error',
      'regexp/no-useless-lazy': 'error',
      'regexp/no-useless-quantifier': 'error',
      'regexp/no-useless-range': 'error',
      'regexp/no-useless-set-operand': 'error',
      'regexp/no-useless-string-literal': 'error',
      'regexp/no-useless-two-nums-quantifier': 'error',
      'regexp/no-zero-quantifier': 'error',
      'regexp/optimal-lookaround-quantifier': 'warn',
      'regexp/optimal-quantifier-concatenation': 'error',
      'regexp/prefer-predefined-assertion': 'error',
      'regexp/prefer-range': 'error',
      'regexp/prefer-set-operation': 'error',
      'regexp/simplify-set-operations': 'error',
      'regexp/use-ignore-case': 'error',
      // RegExp - Stylistic
      'regexp/match-any': 'warn',
      'regexp/no-useless-escape': 'warn',
      'regexp/no-useless-non-capturing-group': 'warn',
      'regexp/prefer-character-class': 'warn',
      'regexp/prefer-d': 'warn',
      'regexp/prefer-plus-quantifier': 'warn',
      'regexp/prefer-question-quantifier': 'warn',
      'regexp/prefer-star-quantifier': 'warn',
      'regexp/prefer-unicode-codepoint-escapes': 'warn',
      'regexp/prefer-w': 'warn',
      'regexp/sort-flags': 'warn',
    },
    overrides: [
      {
        files: [
          'server/**/*',
          'cli/**/*',
          'scripts/**/*',
          'modules/**/*',
          'app/components/OgImage/*',
        ],
        rules: {
          'no-console': 'off',
        },
      },
    ],
    ignorePatterns: [
      '.output/**',
      '.data/**',
      '.nuxt/**',
      '.nitro/**',
      '.cache/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  fmt: {
    semi: false,
    singleQuote: true,
    arrowParens: 'avoid',
    quoteProps: 'consistent',
  },
  staged: {
    'i18n/locales/*':
      'node ./lunaria/lunaria.ts && node scripts/generate-i18n-schema.ts && vp fmt i18n/schema.json && git add i18n/schema.json',
    '*.{js,ts,mjs,cjs,vue}': 'vp lint --fix',
    '*.vue': 'node scripts/unocss-checker.ts',
    '*.{js,ts,mjs,cjs,vue,json,yml,md,html,css}': 'vp fmt',
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '~': `${rootDir}/app`,
            '#shared': `${rootDir}/shared`,
            '#server': `${rootDir}/server`,
          },
        },
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'node',
        },
      },
      () =>
        defineVitestProject({
          test: {
            name: 'nuxt',
            include: ['test/nuxt/**/*.{test,spec}.ts'],
            environment: 'nuxt',
            environmentOptions: {
              nuxt: {
                rootDir: fileURLToPath(new URL('.', import.meta.url)),
                overrides: {
                  vue: {
                    runtimeCompiler: true,
                  },
                  experimental: {
                    payloadExtraction: false,
                    viteEnvironmentApi: false,
                  },
                  pwa: {
                    pwaAssets: { disabled: true },
                  },
                  ogImage: { enabled: false },
                },
              },
            },
            browser: {
              enabled: true,
              provider: playwright(),
              instances: [{ browser: 'chromium', headless: true }],
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
        '**/*.json',
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
