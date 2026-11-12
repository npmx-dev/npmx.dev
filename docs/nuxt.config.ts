export default defineNuxtConfig({
  extends: ['docus'],
  vite: {
    resolve: {
      // The root workspace uses Nuxt 5 nightly; without this, Vite resolves
      // Nuxt 5 app modules inside this Nuxt 4 / Docus build.
      dedupe: ['nuxt'],
    },
  },
  css: ['~/assets/css/main.css'],
  llms: {
    domain: 'https://docs.npmx.dev',
  },
  site: {
    name: 'npmx docs',
  },
  // version conflict with root nuxt-og-image and duplicate deps on satori/takumi
  // TODO migrate docus to latest 5.9.0 and re-enable
  ogImage: {
    enabled: false,
  },
})
