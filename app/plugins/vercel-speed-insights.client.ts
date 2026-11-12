import { injectSpeedInsights } from '@vercel/speed-insights/nuxt/runtime'

export default defineNuxtPlugin({
  env: { islands: false },
  setup() {
    injectSpeedInsights({ sampleRate: 0.1 })
  },
})
