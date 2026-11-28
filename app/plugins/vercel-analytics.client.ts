import { vercelAnalytics } from '#vercel-analytics'
import { createWebAnalyticsFilter, getAnalyticsStorage } from '~/utils/web-analytics'

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

    // The analytics script drains `vaq` when it loads, so the filter has to be queued first.
    window.va(
      'beforeSend',
      createWebAnalyticsFilter({
        storage: getAnalyticsStorage(),
        webdriver: navigator.webdriver === true,
      }),
    )

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
