import { describe, expect, it } from 'vite-plus/test'
import type { NuxtError } from 'nuxt/app'
import { ERROR_UNGH_API_KEY_EXHAUSTED } from '../../../../shared/utils/constants'
import { isUnghRateLimitError } from '../../../../app/utils/changelog-errors'

function nuxtError(fields: Partial<NuxtError>): NuxtError {
  return fields as NuxtError
}

describe('isUnghRateLimitError', () => {
  it('detects the error from its status text', () => {
    expect(isUnghRateLimitError(nuxtError({ statusText: ERROR_UNGH_API_KEY_EXHAUSTED }))).toBe(true)
  })

  it('detects the error from the body message when the status text is lost over HTTP/2', () => {
    expect(
      isUnghRateLimitError(
        nuxtError({ statusText: '', data: { message: ERROR_UNGH_API_KEY_EXHAUSTED } }),
      ),
    ).toBe(true)
  })

  it('ignores other errors', () => {
    expect(isUnghRateLimitError(nuxtError({ statusText: 'Bad Gateway', data: {} }))).toBe(false)
    expect(isUnghRateLimitError(null)).toBe(false)
    expect(isUnghRateLimitError(undefined)).toBe(false)
  })
})
