import { createError } from '#app'
import { getPackageNameValidationError } from '#shared/utils/npm'

/** Validate an npm package name and throw an HTTP error if invalid. */
export function assertValidPackageName(name: string): void {
  const message = getPackageNameValidationError(name)
  if (message) {
    // TODO: throwing 404 rather than 400 as it's cacheable
    throw createError({ status: 404, message })
  }
}
