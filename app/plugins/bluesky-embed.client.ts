import EmbeddableBlueskyPost from '~/components/EmbeddableBlueskyPost.client.vue'

/**
 * INFO: .md files are transformed into Vue SFCs by unplugin-vue-markdown during the Vite transform pipeline
 * That transformation happens before Nuxt's component auto-import scanning can inject the proper imports
 * Global registration ensures the component is available in the Vue runtime regardless of how the SFC was generated
 */
export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.component('EmbeddableBlueskyPost', EmbeddableBlueskyPost)
})
