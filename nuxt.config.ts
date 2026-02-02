import process from 'node:process'
import { currentLocales } from './config/i18n'

export default defineNuxtConfig({
  modules: [
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

  $production: {
    debug: {
      hydration: true,
    },
  },

  runtimeConfig: {
    sessionPassword: '',
    // Upstash Redis for distributed OAuth token refresh locking in production
    upstash: {
      redisRestUrl: process.env.KV_REST_API_URL || '',
      redisRestToken: process.env.KV_REST_API_TOKEN || '',
    },
  },

  devtools: { enabled: true },

  devServer: {
    // Used with atproto oauth
    // https://atproto.com/specs/oauth#localhost-client-development
    host: '127.0.0.1',
  },

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
    '/:pkg/.well-known/skills/**': { isr: 3600 },
    '/:scope/:pkg/.well-known/skills/**': { isr: 3600 },
    // never cache
    '/search': { isr: false, cache: false },
    '/api/auth/**': { isr: false, cache: false },
    // infinite cache (versioned - doesn't change)
    '/package-code/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/package-docs/:pkg/v/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/package-docs/:scope/:pkg/v/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/docs/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/file/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/files/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/_avatar/**': {
      isr: 3600,
      proxy: {
        to: 'https://www.gravatar.com/avatar/**',
      },
    },
    // static pages
    '/about': { prerender: true },
    '/settings': { prerender: true },
    '/oauth-client-metadata.json': { prerender: true },
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

  compatibilityDate: '2026-01-31',

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
      'oauth-atproto-state': {
        driver: 'fsLite',
        base: './.cache/atproto-oauth/state',
      },
      'oauth-atproto-session': {
        driver: 'fsLite',
        base: './.cache/atproto-oauth/session',
      },
    },
    typescript: {
      tsConfig: {
        include: ['../test/unit/server/**/*.ts'],
      },
    },
  },

  fonts: {
    families: [
      {
        name: 'Geist',
        weights: ['400', '500', '600'],
        preload: true,
        global: true,
      },
      {
        name: 'Geist Mono',
        weights: ['400', '500'],
        preload: true,
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
    // Disable service worker
    disable: true,
    pwaAssets: {
      config: false,
    },
    manifest: {
      name: 'npmx',
      short_name: 'npmx',
      description: 'A fast, modern browser for the npm registry',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
      icons: [
        {
          src: 'pwa-64x64.png',
          sizes: '64x64',
          type: 'image/png',
        },
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'maskable-icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
  },

  typescript: {
    tsConfig: {
      compilerOptions: {
        noUnusedLocals: true,
      },
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
