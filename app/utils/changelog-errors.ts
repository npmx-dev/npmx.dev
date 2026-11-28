import type { NuxtError } from 'nuxt/app'
import { ERROR_GITHUB_RATE_LIMITED } from '#shared/utils/constants'

/**
 * Whether a changelog fetch failed on GitHub's rate limit.
 *
 * The status text is lost over HTTP/2, which has no reason phrase, so client-side
 * fetches also check the `message` in the error body.
 */
export function isGithubRateLimitError(error: NuxtError | null | undefined): boolean {
  const data = error?.data as { message?: unknown } | undefined
  return (
    error?.statusText === ERROR_GITHUB_RATE_LIMITED || data?.message === ERROR_GITHUB_RATE_LIMITED
  )
}
