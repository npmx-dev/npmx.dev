export default defineNuxtConfig({
  extends: ['docus'],
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
