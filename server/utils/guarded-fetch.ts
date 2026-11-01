import type { FetchLike } from 'forges'
import { resolveAndValidateHost } from '#server/utils/image-proxy'

/**
 * A `fetch` for URLs whose host comes from user input. `forges` dereferences a
 * Tangled handle as a host, so this refuses private addresses the way the image
 * proxy does instead of letting the request reach an internal service.
 */
export const guardedFetch: FetchLike = async (input, init) => {
  if (!(await resolveAndValidateHost(input))) {
    throw new Error(`Refusing to fetch ${input}`)
  }
  return fetch(input, init)
}
