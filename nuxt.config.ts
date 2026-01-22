// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
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
  // Ensure that any HTML validation errors are treated as build errors
  htmlValidator: {
    failOnError: true,
  },
})
