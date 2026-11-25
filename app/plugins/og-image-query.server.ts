type OgImagePayloadEntry = [key: string, options: Record<string, unknown>, basePath?: string]

const PAYLOADS_KEY = '_ogImagePayloads'
const QUERY_KEY = '_query'

export function stripOgImageQuery(ssrContext?: Record<string, unknown>): void {
  const payloads = ssrContext?.[PAYLOADS_KEY] as OgImagePayloadEntry[] | undefined
  if (!Array.isArray(payloads)) return

  for (const entry of payloads) {
    const options = entry?.[1]
    if (options && typeof options === 'object' && options.component !== 'PageScreenshot') {
      delete options[QUERY_KEY]
    }
  }
}

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.hook('app:rendered', ctx => {
    stripOgImageQuery(ctx.ssrContext as Record<string, unknown> | undefined)
  })
})
