import process from 'node:process'
import { currentLocales } from './config/i18n'
import { isCI, provider } from 'std-env'

export default defineNuxtConfig({
  modules: [
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

  $test: {
    debug: {
      hydration: true,
    },
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    dataValue: 'theme',
    storageKey: 'npmx-color-mode',
  },

  css: ['~/assets/main.css', 'vue-data-ui/style.css'],

  runtimeConfig: {
    sessionPassword: '',
    github: {
      orgToken: '',
    },
    // Upstash Redis for distributed OAuth token refresh locking in production
    upstash: {
      redisRestUrl: process.env.UPSTASH_KV_REST_API_URL || process.env.KV_REST_API_URL || '',
      redisRestToken: process.env.UPSTASH_KV_REST_API_TOKEN || process.env.KV_REST_API_TOKEN || '',
    },
    public: {
      // Algolia npm-search index (maintained by Algolia & jsDelivr, used by yarnpkg.com et al.)
      algolia: {
        appId: 'OFCNCOG2CU',
        apiKey: 'f54e21fa3a2a0160595bb058179bfb1e',
        indexName: 'npm-search',
      },
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

  router: {
    options: {
      scrollBehaviorType: 'smooth',
    },
  },

  routeRules: {
    // API routes
    '/api/**': { isr: 60 },
    '/api/registry/badge/**': {
      isr: {
        expiration: 60 * 60 /* one hour */,
        passQuery: true,
        allowQuery: ['color', 'labelColor', 'label', 'name'],
      },
    },
    '/api/registry/downloads/**': {
      isr: {
        expiration: 60 * 60 /* one hour */,
        passQuery: true,
        allowQuery: ['mode', 'filterOldVersions', 'filterThreshold'],
      },
    },
    '/api/registry/docs/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/file/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/provenance/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/files/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/api/registry/package-meta/**': { isr: 300 },
    '/:pkg/.well-known/skills/**': { isr: 3600 },
    '/:scope/:pkg/.well-known/skills/**': { isr: 3600 },
    '/__og-image__/**': getISRConfig(60),
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
    '/package/:name': getISRConfig(60, { fallback: 'html' }),
    '/package/:name/_payload.json': getISRConfig(60, { fallback: 'json' }),
    '/package/:name/v/:version': getISRConfig(60, { fallback: 'html' }),
    '/package/:name/v/:version/_payload.json': getISRConfig(60, { fallback: 'json' }),
    '/package/:org/:name': getISRConfig(60, { fallback: 'html' }),
    '/package/:org/:name/_payload.json': getISRConfig(60, { fallback: 'json' }),
    '/package/:org/:name/v/:version': getISRConfig(60, { fallback: 'html' }),
    '/package/:org/:name/v/:version/_payload.json': getISRConfig(60, { fallback: 'json' }),
    // infinite cache (versioned - doesn't change)
    '/package-code/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    '/package-docs/**': { isr: true, cache: { maxAge: 365 * 24 * 60 * 60 } },
    // static pages
    '/': { prerender: true },
    '/200.html': { prerender: true },
    '/about': { prerender: true },
    '/accessibility': { prerender: true },
    '/privacy': { prerender: true },
    '/search': { isr: false, cache: false }, // never cache
    '/settings': { prerender: true },
    '/recharging': { prerender: true },
    // proxy for insights
    '/_v/script.js': { proxy: 'https://npmx.dev/_vercel/insights/script.js' },
    '/_v/view': { proxy: 'https://npmx.dev/_vercel/insights/view' },
    '/_v/event': { proxy: 'https://npmx.dev/_vercel/insights/event' },
    '/_v/session': { proxy: 'https://npmx.dev/_vercel/insights/session' },
    // lunaria status.json
    '/lunaria/status.json': {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    },
  },

  experimental: {
    entryImportMap: false,
    typescriptPlugin: true,
    viteEnvironmentApi: true,
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
    esbuild: {
      options: {
        target: 'es2024',
      },
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
    enabled: !isCI || (provider !== 'vercel' && !!process.env.VALIDATE_HTML),
    options: {
      rules: { 'meta-refresh': 'off' },
    },
    failOnError: true,
  },

  ogImage: {
    defaults: {
      component: 'Default',
    },
    fonts: [
      { name: 'Geist', weight: 400, path: '/fonts/Geist-Regular.ttf' },
      { name: 'Geist', weight: 500, path: '/fonts/Geist-Medium.ttf' },
      { name: 'Geist', weight: 600, path: '/fonts/Geist-SemiBold.ttf' },
      { name: 'Geist', weight: 700, path: '/fonts/Geist-Bold.ttf' },
      { name: 'Geist Mono', weight: 400, path: '/fonts/GeistMono-Regular.ttf' },
      { name: 'Geist Mono', weight: 500, path: '/fonts/GeistMono-Medium.ttf' },
      { name: 'Geist Mono', weight: 700, path: '/fonts/GeistMono-Bold.ttf' },
    ],
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
        paths: {
          '#cli/*': ['../cli/src/*'],
        },
      },
      include: ['../test/unit/app/**/*.ts'],
    },
    sharedTsConfig: {
      include: ['../test/unit/shared/**/*.ts'],
    },
    nodeTsConfig: {
      compilerOptions: {
        allowImportingTsExtensions: true,
        paths: {
          '#cli/*': ['../cli/src/*'],
          '#server/*': ['../server/*'],
          '#shared/*': ['../shared/*'],
        },
      },
      include: ['../*.ts', '../test/e2e/**/*.ts'],
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vueuse/core',
        '@vueuse/integrations/useFocusTrap',
        '@vueuse/integrations/useFocusTrap/component',
        'vue-data-ui/vue-ui-sparkline',
        'vue-data-ui/vue-ui-xy',
        'virtua/vue',
        'semver',
        'validate-npm-package-name',
        '@atproto/lex',
        'fast-npm-meta',
        '@floating-ui/vue',
        'algoliasearch/lite',
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

interface ISRConfigOptions {
  fallback?: 'html' | 'json'
}
function getISRConfig(expirationSeconds: number, options: ISRConfigOptions = {}) {
  if (options.fallback) {
    return {
      isr: {
        expiration: expirationSeconds,
        fallback:
          options.fallback === 'html' ? 'spa.prerender-fallback.html' : 'payload-fallback.json',
        initialHeaders: options.fallback === 'json' ? { 'content-type': 'application/json' } : {},
      } as { expiration: number },
    }
  }
  return {
    isr: {
      expiration: expirationSeconds,
    },
  }
}
