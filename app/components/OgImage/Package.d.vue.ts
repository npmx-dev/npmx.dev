// This type declaration file is required to break a circular type resolution in vue-tsc.
//
// nuxt-og-image generates a type declaration (.nuxt/module/nuxt-og-image.d.ts) that imports
// this component's type. This creates a cycle: nuxt.d.ts → nuxt-og-image.d.ts → Package.vue →
// needs auto-import globals from nuxt.d.ts. Without this file, vue-tsc resolves the component
// before the globals are available, so all auto-imports (computed, toRefs, useFetch, etc.) fail.

import type { DefineComponent } from 'vue'

declare const _default: DefineComponent<{
  name: string
  version: string
  primaryColor?: string
}>

export default _default
