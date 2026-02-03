export default defineNuxtPlugin({
  enforce: 'pre',
  setup(nuxtApp) {
    // TODO: investigate why this is needed
    nuxtApp.payload.data ||= {}
  },
})
