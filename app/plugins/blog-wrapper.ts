import BlogPostWrapper from '~/components/BlogPostWrapper.vue'

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.vueApp.component('BlogPostWrapper', BlogPostWrapper)
})
