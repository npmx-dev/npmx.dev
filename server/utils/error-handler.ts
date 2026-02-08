import { isError, createError } from 'h3'
import * as v from 'valibot'
import type { ErrorOptions } from '#shared/types/error'

/**
 * Generic error handler for Nitro routes
 * Handles H3 errors, Valibot, and fallbacks in that order
 */
export function handleApiError(error: unknown, fallback: ErrorOptions): never {
  // If already a known Nuxt/H3 Error, apply fallback only when the error has a generic 500 status
  if (isError(error)) {
    if (error.statusCode === 500 && fallback.statusCode) {
      error.statusCode = fallback.statusCode
    }
    if (error.statusMessage === 'Server Error' && fallback.statusMessage) {
      error.statusMessage = fallback.statusMessage
    }
    throw error
  }

  // Handle Valibot validation errors
  if (v.isValiError(error)) {
    throw createError({
      // TODO: throwing 404 rather than 400 as it's cacheable
      statusCode: 404,
      message: error.issues[0].message,
    })
  }

  // Generic fallback
  throw createError({
    statusCode: fallback.statusCode ?? 502,
    statusMessage: fallback.statusMessage,
    message: fallback.message,
  })
}
