export default defineNuxtConfig({
  modules: [
    '@unocss/nuxt',
    '@nuxt/eslint',
    '@nuxtjs/html-validator',
    '@nuxt/scripts',
    '@nuxt/fonts',
    '@nuxt/image',
    'nuxt-og-image',
    '@nuxt/test-utils',
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

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    typedPages: true,
  },

  compatibilityDate: '2024-04-03',

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
})
