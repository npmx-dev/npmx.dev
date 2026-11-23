import { vercelAnalytics } from '#vercel-analytics'

export default defineNuxtPlugin({
  enforce: 'pre',
  env: { islands: false },
  setup() {
    if (import.meta.test || import.meta.dev) {
      return
    }

    window.va = function (...params: unknown[]) {
      ;(window.vaq = window.vaq || []).push(params)
    }

    useScript({
      'src': vercelAnalytics.scriptSrc ?? '/_vercel/insights/script.js',
      'data-view-endpoint': vercelAnalytics.viewEndpoint,
      'data-event-endpoint': vercelAnalytics.eventEndpoint,
      'data-session-endpoint': vercelAnalytics.sessionEndpoint,
    })
  },
})

declare global {
  interface Window {
    va?: (...args: unknown[]) => void
    vaq?: unknown[][]
  }
}
