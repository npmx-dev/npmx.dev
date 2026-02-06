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
      title: 'npmx',
      link: [
        {
          rel: 'search',
          type: 'application/opensearchdescription+xml',
          title: 'npm',
          href: '/opensearch.xml',
        },
      ],
      meta: [{ name: 'twitter:card', content: 'summary_large_image' }],
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
    // API routes
    '/api/**': { isr: 60 },
    '/api/registry/docs/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/file/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/provenance/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/files/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/:pkg/.well-known/skills/**': { isr: 3600 },
    '/:scope/:pkg/.well-known/skills/**': { isr: 3600 },
    '/__og-image__/**': { isr: getISRConfig(60) },
    '/_avatar/**': { isr: 3600, proxy: 'https://www.gravatar.com/avatar/**' },
    '/opensearch.xml': { isr: true },
    '/oauth-client-metadata.json': { prerender: true },
    // never cache
    '/api/auth/**': { isr: false, cache: false },
    '/api/social/**': { isr: false, cache: false },
    '/api/opensearch/suggestions': {
      isr: {
        expiration: 60 * 60 * 24 /* one day */,
        passQuery: true,
        allowQuery: ['q'],
      },
    },
    // pages
    '/package/:name': { isr: getISRConfig(60, true) },
    '/package/:name/v/:version': { isr: getISRConfig(60, true) },
    '/package/:org/:name': { isr: getISRConfig(60, true) },
    '/package/:org/:name/v/:version': { isr: getISRConfig(60, true) },
    // infinite cache (versioned - doesn't change)
    '/package-code/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/package-docs/:name/v/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/package-docs/:org/:name/v/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    // static pages
    '/': { prerender: true },
    '/200.html': { prerender: true },
    '/accessibility': { prerender: true },
    '/about': { prerender: true },
    '/privacy': { prerender: true },
    '/search': { isr: false, cache: false }, // never cache
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

  compatibilityDate: '2026-01-31',

  nitro: {
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
      'atproto': {
        driver: 'fsLite',
        base: './.cache/atproto',
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
        allowImportingTsExtensions: true,
      },
      include: ['../test/unit/app/**/*.ts'],
    },
    sharedTsConfig: {
      include: ['../test/unit/shared/**/*.ts'],
    },
    nodeTsConfig: {
      compilerOptions: {
        allowImportingTsExtensions: true,
      },
      include: ['../*.ts'],
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vueuse/core',
        '@vueuse/integrations/useFocusTrap',
        'vue-data-ui/vue-ui-sparkline',
        'vue-data-ui/vue-ui-xy',
        'virtua/vue',
        'semver',
        'validate-npm-package-name',
        '@atproto/lex',
        'fast-npm-meta',
        '@floating-ui/vue',
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

  imports: {
    dirs: ['~/composables', '~/composables/*/*.ts'],
  },
})

function getISRConfig(expirationSeconds: number, fallback = false) {
  if (fallback) {
    return {
      expiration: expirationSeconds,
      fallback: 'spa.prerender-fallback.html',
    } as { expiration: number }
  }
  return {
    expiration: expirationSeconds,
  }
}
