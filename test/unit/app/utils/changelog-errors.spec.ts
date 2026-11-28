import { describe, expect, it } from 'vite-plus/test'
import type { NuxtError } from 'nuxt/app'
import { ERROR_GITHUB_RATE_LIMITED } from '../../../../shared/utils/constants'
import { isGithubRateLimitError } from '../../../../app/utils/changelog-errors'

function nuxtError(fields: Partial<NuxtError>): NuxtError {
  return fields as NuxtError
}

describe('isGithubRateLimitError', () => {
  it('detects the error from its status text', () => {
    expect(isGithubRateLimitError(nuxtError({ statusText: ERROR_GITHUB_RATE_LIMITED }))).toBe(true)
  })

  it('detects the error from the body message when the status text is lost over HTTP/2', () => {
    expect(
      isGithubRateLimitError(
        nuxtError({ statusText: '', data: { message: ERROR_GITHUB_RATE_LIMITED } }),
      ),
    ).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isGithubRateLimitError(nuxtError({ statusText: 'Bad Gateway', data: {} }))).toBe(false)
    expect(isGithubRateLimitError(null)).toBe(false)
    expect(isGithubRateLimitError(undefined)).toBe(false)
  })
})
