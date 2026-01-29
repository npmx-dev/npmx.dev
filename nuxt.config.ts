import { currentLocales } from './config/i18n'

export default defineNuxtConfig({
  modules: [
    function (_, nuxt) {
      if (nuxt.options._prepare) {
        nuxt.options.pwa ||= {}
        nuxt.options.pwa.pwaAssets ||= {}
        nuxt.options.pwa.pwaAssets.disabled = true
      }
    },
    // Workaround for Nuxt 4.3.0 regression: https://github.com/nuxt/nuxt/issues/34140
    // shared-imports.d.ts pulls in app composables during type-checking of shared context,
    // but the shared context doesn't have access to auto-import globals.
    // TODO: Remove when Nuxt fixes this upstream
    function (_, nuxt) {
      nuxt.hook('prepare:types', ({ sharedReferences }) => {
        const idx = sharedReferences.findIndex(
          ref => 'path' in ref && ref.path.endsWith('shared-imports.d.ts'),
        )
        if (idx !== -1) {
          sharedReferences.splice(idx, 1)
        }
      })
    },
    '@unocss/nuxt',
    '@nuxtjs/html-validator',
    '@nuxt/scripts',
    '@nuxt/a11y',
    '@nuxt/fonts',
    'nuxt-og-image',
    '@nuxt/test-utils',
    '@vite-pwa/nuxt',
    '@vueuse/nuxt',
    '@nuxtjs/i18n',
    '@nuxtjs/color-mode',
  ],

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    dataValue: 'theme',
    storageKey: 'npmx-color-mode',
  },

  css: ['~/assets/main.css', 'vue-data-ui/style.css'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en-US' },
      link: [
        {
          rel: 'search',
          type: 'application/opensearchdescription+xml',
          title: 'npm',
          href: '/opensearch.xml',
        },
      ],
    },
  },

  vue: {
    compilerOptions: {
      isCustomElement: tag => tag === 'search',
    },
  },

  site: {
    url: 'https://npmx.dev',
    name: 'npmx',
    description: 'A fast, modern browser for the npm registry',
  },

  routeRules: {
    '/': { prerender: true },
    '/opensearch.xml': { isr: true },
    '/**': { isr: 60 },
    '/package/**': { isr: 60 },
    '/search': { isr: false, cache: false },
    // static pages
    '/about': { prerender: true },
    '/settings': { prerender: true },
    // proxy for insights
    '/_v/script.js': { proxy: 'https://npmx.dev/_vercel/insights/script.js' },
    '/_v/view': { proxy: 'https://npmx.dev/_vercel/insights/view' },
    '/_v/event': { proxy: 'https://npmx.dev/_vercel/insights/event' },
    '/_v/session': { proxy: 'https://npmx.dev/_vercel/insights/session' },
  },

  experimental: {
    entryImportMap: false,
    viteEnvironmentApi: true,
    viewTransition: true,
    typedPages: true,
  },

  compatibilityDate: '2024-04-03',

  nitro: {
    experimental: {
      wasm: true,
    },
    externals: {
      inline: [
        'shiki',
        '@shikijs/langs',
        '@shikijs/themes',
        '@shikijs/types',
        '@shikijs/engine-javascript',
        '@shikijs/core',
      ],
      external: ['@deno/doc'],
    },
    rollupConfig: {
      output: {
        paths: {
          '@deno/doc': '@jsr/deno__doc',
        },
      },
    },
    // Storage configuration for local development
    // In production (Vercel), this is overridden by modules/cache.ts
    storage: {
      'fetch-cache': {
        driver: 'fsLite',
        base: './.cache/fetch',
      },
    },
  },

  fonts: {
    families: [
      {
        name: 'Geist',
        weights: ['400', '500', '600'],
        global: true,
      },
      {
        name: 'Geist Mono',
        weights: ['400', '500'],
        global: true,
      },
    ],
  },

  htmlValidator: {
    failOnError: true,
  },

  ogImage: {
    defaults: {
      component: 'Default',
    },
  },

  pwa: {
    // Disable service worker - only using for asset generation
    disable: true,
    pwaAssets: {
      config: true,
    },
    manifest: {
      name: 'npmx',
      short_name: 'npmx',
      description: 'A fast, modern browser for the npm registry',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vueuse/core',
        'vue-data-ui/vue-ui-sparkline',
        'vue-data-ui/vue-ui-xy',
        'virtua/vue',
        'semver',
        'validate-npm-package-name',
      ],
    },
  },

  i18n: {
    locales: currentLocales,
    defaultLocale: 'en-US',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    langDir: 'locales',
  },
})
