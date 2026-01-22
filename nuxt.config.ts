export default defineNuxtConfig({
  modules: [
    function (_, nuxt) {
      if (nuxt.options._prepare) {
        nuxt.options.pwa ||= {}
        nuxt.options.pwa.pwaAssets ||= {}
        nuxt.options.pwa.pwaAssets.disabled = true
      }
    },
    function (_, nuxt) {
      nuxt.hook('modules:done', () => {
        nuxt.hook('nitro:build:before', (nitro) => {
          nitro.options.ssrRoutes = []
        })
      })
    },
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
    '/package/**': { isr: 60 },
    '/~**': { isr: 60 },
    '/api/**': { isr: 60 },
    '/_v/script.js': { proxy: 'https://npmx.dev/_vercel/insights/script.js' },
    '/_v/view': { proxy: 'https://npmx.dev/_vercel/insights/view' },
    '/_v/event': { proxy: 'https://npmx.dev/_vercel/insights/event' },
    '/_v/session': { proxy: 'https://npmx.dev/_vercel/insights/session' },
  },

  experimental: {
    viewTransition: true,
    typedPages: true,
  },

  compatibilityDate: '2024-04-03',

  nitro: {
    externals: {
      // Inline shiki modules to avoid module resolution issues on Vercel
      inline: [
        'shiki',
        '@shikijs/langs',
        '@shikijs/themes',
        '@shikijs/types',
        '@shikijs/engine-javascript',
        '@shikijs/core',
      ],
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
        name: 'Geist',
        weights: ['400', '500', '600'],
        global: true,
      },
      {
        name: 'JetBrains Mono',
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
      description: 'A fast, accessible npm package browser for power users',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
    },
  },
})
