// This type declaration file is required to break a circular type resolution in vue-tsc.
// And is based off Package.d.vue.ts

import type { DefineComponent } from 'vue'

declare const _default: DefineComponent<{
  title: string
  authors?: { name: string; blueskyHandle?: string }[]
  date?: string
  primaryColor?: string
}>

export default _default
