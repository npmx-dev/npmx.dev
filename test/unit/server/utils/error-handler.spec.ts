import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import * as v from 'valibot'
import { handleApiError } from '../../../../server/utils/error-handler'

function h3Error(statusCode: number, message: string) {
  const error = createError({ statusCode, message })
  error.statusCode = statusCode
  return error
}

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

    const expected = h3Error(404, 'Name is required')
    expect(() => handleApiError(valibotError, fallback)).toThrow(expected)
  })

  it('throws a fallback error with the given statusCode and message', () => {
    const expected = h3Error(502, 'Bad gateway')
    expect(() =>
      handleApiError(new Error('unexpected'), { message: 'Bad gateway', statusCode: 502 }),
    ).toThrow(expected)
  })

  it('defaults fallback statusCode to 502 when not provided', () => {
    const expected = h3Error(502, 'Upstream failed')
    expect(() => handleApiError('some string error', { message: 'Upstream failed' })).toThrow(
      expected,
    )
  })

  it('uses the custom fallback statusCode when provided', () => {
    const expected = h3Error(503, 'Service unavailable')
    expect(() => handleApiError(null, { message: 'Service unavailable', statusCode: 503 })).toThrow(
      expected,
    )
  })
})
