import { isError, createError } from 'h3'
import * as v from 'valibot'
import type { ErrorOptions } from '#shared/types/error'

/**
 * Generic error handler for Nitro routes
 * Handles H3 errors, Valibot, and fallbacks in that order
 */
export function handleApiError(error: unknown, fallback: ErrorOptions): never {
  // If already a known Nuxt/H3 Error, re-throw
  if (isError(error)) {
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
    message: fallback.message,
  })
}
