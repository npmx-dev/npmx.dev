import { stringify } from 'devalue'

/**
 * Nuxt server plugin that serializes the payload after SSR rendering
 * and stashes it on the request event context.
 *
 * This allows the Nitro payload-cache plugin to cache the payload
 * when rendering HTML pages, so that subsequent _payload.json requests
 * for the same route can be served from cache without a full re-render.
 *
 * This mirrors what Nuxt does during pre-rendering (via `payloadCache`),
 * but extends it to runtime for ISR-enabled routes.
 */
export default defineNuxtPlugin({
  name: 'payload-cache',
  setup(nuxtApp) {
    // Only run on the server during SSR
    if (import.meta.client) return

    nuxtApp.hooks.hook('app:rendered', () => {
      const ssrContext = nuxtApp.ssrContext
      if (!ssrContext) return

      // Don't cache error responses or noSSR renders
      if (ssrContext.noSSR || ssrContext.error || ssrContext.payload?.error) return

      // Don't cache if payload data is empty
      const payloadData = ssrContext.payload?.data
      if (!payloadData || Object.keys(payloadData).length === 0) return

      try {
        // Serialize the payload using devalue (same as Nuxt's renderPayloadResponse)
        // splitPayload extracts only { data, prerenderedAt } for the external payload
        const payload = {
          data: ssrContext.payload.data,
          prerenderedAt: ssrContext.payload.prerenderedAt,
        }
        const reducers = ssrContext['~payloadReducers'] ?? {}
        const body = stringify(payload, reducers)

        // Stash the serialized payload on the event context
        // The Nitro payload-cache plugin will pick this up in render:response
        const event = ssrContext.event
        if (event) {
          event.context._cachedPayloadResponse = {
            body,
            statusCode: 200,
            headers: {
              'content-type': 'application/json;charset=utf-8',
              'x-powered-by': 'Nuxt',
            },
          }
        }
      } catch (error) {
        // Serialization failed — don't cache, but don't break the render
        if (import.meta.dev) {
          // eslint-disable-next-line no-console
          console.warn('[payload-cache] Failed to serialize payload:', error)
        }
      }
    })
  },
})
