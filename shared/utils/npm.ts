import { createError } from 'h3'
import validatePackageName from 'validate-npm-package-name'

/**
 * Validate an npm package name and throw an HTTP error if invalid.
 * Uses validate-npm-package-name to check against npm naming rules.
 */
export function assertValidPackageName(name: string): void {
  const result = validatePackageName(name)
  if (!result.validForNewPackages && !result.validForOldPackages) {
    const errors = [...(result.errors ?? []), ...(result.warnings ?? [])]
    throw createError({
      statusCode: 400,
      message: `Invalid package name: ${errors[0] ?? 'unknown error'}`,
    })
  }
}
