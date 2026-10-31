import { createError, isNuxtError } from 'nuxt/server'
import { FetchError } from 'ofetch'
import * as v from 'valibot'
import type { ErrorOptions } from '#shared/types/error'

/**
 * Generic error handler for Nitro routes
 * Handles H3 errors, Valibot, and fallbacks in that order
 */
export function handleApiError(error: unknown, fallback: ErrorOptions): never {
  // If already a known Nuxt error, apply fallback only when the error has a generic 500 status
  if (isNuxtError(error)) {
    const nuxtError = error as typeof error & { status: number; statusText?: string }
    if (nuxtError.status === 500 && fallback.status) {
      nuxtError.status = fallback.status
    }
    if (nuxtError.statusText === 'Server Error' && fallback.statusText) {
      nuxtError.statusText = fallback.statusText
    }
    throw error
  }

  if (error instanceof FetchError && error.statusCode) {
    throw createError({
      status: error.statusCode,
      statusText: error.statusMessage,
      message: error.message,
    })
  }

  // Handle Valibot validation errors
  if (v.isValiError(error)) {
    throw createError({
      // TODO: throwing 404 rather than 400 as it's cacheable
      status: 404,
      message: error.issues[0].message,
    })
  }

  // Generic fallback
  throw createError({
    status: fallback.status ?? 502,
    statusText: fallback.statusText,
    message: fallback.message,
  })
}
