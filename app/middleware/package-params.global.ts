import { assertValidPackageRoute } from '#shared/utils/package-route-validation'

export default defineNuxtRouteMiddleware(to => {
  // Only the server render makes the first upstream requests. On the client the API
  // handlers behind the page respond with a 404 for an invalid coordinate.
  if (!import.meta.server) {
    return
  }

  assertValidPackageRoute({
    path: to.path,
    params: to.params as Record<string, string | string[] | undefined>,
    query: to.query,
  })
})
