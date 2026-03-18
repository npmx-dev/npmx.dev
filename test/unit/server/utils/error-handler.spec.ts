import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import { FetchError } from 'ofetch'
import * as v from 'valibot'
import { handleApiError } from '../../../../server/utils/error-handler'

describe('handleApiError', () => {
  const fallback = { message: 'Something went wrong', statusCode: 500 }

  it('re-throws H3 errors as-is', () => {
    const h3Err = createError({ statusCode: 404, message: 'Not found' })

    expect(() => handleApiError(h3Err, fallback)).toThrow(h3Err)
  })

  it('throws a 404 with the first issue message for valibot errors', () => {
    const schema = v.object({ name: v.pipe(v.string(), v.minLength(1, 'Name is required')) })

    let valibotError: unknown
    try {
      v.parse(schema, { name: '' })
    } catch (e) {
      valibotError = e
    }

    expect(() => handleApiError(valibotError, fallback)).toThrow(
      expect.objectContaining({ statusCode: 404, message: 'Name is required' }),
    )
  })

  it('throws a fallback error with the given statusCode and message', () => {
    expect(() =>
      handleApiError(new Error('unexpected'), { message: 'Bad gateway', statusCode: 502 }),
    ).toThrow(expect.objectContaining({ statusCode: 502, message: 'Bad gateway' }))
  })

  it('defaults fallback statusCode to 502 when not provided', () => {
    expect(() => handleApiError('some string error', { message: 'Upstream failed' })).toThrow(
      expect.objectContaining({ statusCode: 502, message: 'Upstream failed' }),
    )
  })

  it('uses the custom fallback statusCode when provided', () => {
    expect(() => handleApiError(null, { message: 'Service unavailable', statusCode: 503 })).toThrow(
      expect.objectContaining({ statusCode: 503, message: 'Service unavailable' }),
    )
  })

  describe('FetchError handling', () => {
    it('propagates the upstream statusCode from a FetchError', () => {
      const fetchErr = new FetchError('Not Found')
      fetchErr.statusCode = 404
      fetchErr.statusMessage = 'Not Found'

      expect(() => handleApiError(fetchErr, fallback)).toThrow(
        expect.objectContaining({ statusCode: 404, message: 'Not Found' }),
      )
    })

    it('propagates a 503 statusCode from a FetchError', () => {
      const fetchErr = new FetchError('Service Unavailable')
      fetchErr.statusCode = 503
      fetchErr.statusMessage = 'Service Unavailable'

      expect(() => handleApiError(fetchErr, fallback)).toThrow(
        expect.objectContaining({ statusCode: 503 }),
      )
    })

    it('falls through to the generic fallback when FetchError has no statusCode', () => {
      const fetchErr = new FetchError('Network error')

      expect(() => handleApiError(fetchErr, { message: 'Bad gateway', statusCode: 502 })).toThrow(
        expect.objectContaining({ statusCode: 502, message: 'Bad gateway' }),
      )
    })
  })
})
