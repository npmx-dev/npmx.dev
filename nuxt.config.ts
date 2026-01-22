export default defineNuxtConfig({
  modules: [
    '@unocss/nuxt',
    '@nuxt/eslint',
    '@nuxtjs/html-validator',
    '@nuxt/scripts',
    '@nuxt/fonts',
    'nuxt-og-image',
    '@nuxt/test-utils',
    '@vite-pwa/nuxt',
  ],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
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
    description: 'A fast, accessible npm package browser for power users',
  },

  routeRules: {
    '/': { prerender: true },
    '/**': { isr: 60 },
    '/search': { isr: false, cache: false },
    '/_v/script.js': { proxy: 'https://npmx.dev/_vercel/insights/script.js' },
    '/_v/view': { proxy: 'https://npmx.dev/_vercel/insights/view' },
    '/_v/event': { proxy: 'https://npmx.dev/_vercel/insights/event' },
    '/_v/session': { proxy: 'https://npmx.dev/_vercel/insights/session' },
  },

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    viewTransition: true,
    typedPages: true,
  },

  compatibilityDate: '2024-04-03',

  nitro: {
    externals: {
      inline: ['isomorphic-dompurify'],
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  fonts: {
    families: [
      {
        name: 'Inter',
        weights: ['400', '500', '600'],
      },
      {
        name: 'JetBrains Mono',
        weights: ['400', '500'],
      },
    ],
  },

  htmlValidator: {
    failOnError: true,
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
      description: 'A fast, accessible npm package browser for power users',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
    },
  },
})
