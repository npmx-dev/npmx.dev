import type { NuxtError } from 'nuxt/app'
import { ERROR_UNGH_API_KEY_EXHAUSTED } from '#shared/utils/constants'

/**
 * Whether a changelog fetch failed because ungh's GitHub tokens are exhausted.
 *
 * The status text is lost over HTTP/2, which has no reason phrase, so client-side
 * fetches also check the `message` in the error body.
 */
export function isUnghRateLimitError(error: NuxtError | null | undefined): boolean {
  const data = error?.data as { message?: unknown } | undefined
  return (
    error?.statusText === ERROR_UNGH_API_KEY_EXHAUSTED ||
    data?.message === ERROR_UNGH_API_KEY_EXHAUSTED
  )
}
