export default defineNuxtConfig({
  extends: ['docus'],
  css: ['~/assets/css/main.css'],
  llms: {
    domain: 'https://docs.npmx.dev',
  },
  site: {
    name: 'npmx docs',
  },
})
