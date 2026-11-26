/**
 * Server-render client-only pages for link preview bots, so shared links get meta tags.
 * The response is only read for its head, so it skips scripts and the app chrome.
 */
export default defineEventHandler(event => {
  const routeRules = getRouteRules(event)
  if (routeRules.ssr !== false || !isUnfurlUserAgent(getRequestHeader(event, 'user-agent'))) {
    return
  }
  event.context._nitro = {
    ...event.context._nitro,
    routeRules: { ...routeRules, ssr: true, noScripts: true },
  }
  event.context.unfurl = true
})

declare module 'h3' {
  interface H3EventContext {
    unfurl?: boolean
  }
}
