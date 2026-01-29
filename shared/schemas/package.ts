import * as v from 'valibot'
import validateNpmPackageName from 'validate-npm-package-name'

/**
 * Enforces only valid NPM package names
 * Accepts both new and legacy package name formats
 * Leverages 'validate-npm-package-name'
 */
export const PackageNameSchema = v.pipe(
  v.string(),
  v.nonEmpty('Package name is required'),
  v.check(input => {
    const result = validateNpmPackageName(input)
    return result.validForNewPackages || result.validForOldPackages
  }, 'Invalid package name format'),
)

/**
 * Enforces a SemVer-like pattern to prevent directory traversal or complex injection attacks
 * includes: alphanumeric, dots, underscores, dashes, and plus signs (for build metadata)
 */
export const VersionSchema = v.pipe(
  v.string(),
  v.nonEmpty('Version is required'),
  v.regex(/^[a-z0-9._+-]+$/i, 'Invalid version format'),
)

/**
 *
 * Allows standard subdirectories and extensions but prevents directory traversal
 */
export const FilePathSchema = v.pipe(
  v.string(),
  v.nonEmpty('File path is required'),
  v.check(input => !input.includes('..'), 'Invalid path: directory traversal not allowed'),
  v.check(input => !input.startsWith('/'), 'Invalid path: must be relative to package root'),
)

/**
 * Schema for search queries, limits length to guard against DoS attacks
 */
export const SearchQuerySchema = v.pipe(
  v.string(),
  v.trim(),
  v.maxLength(100, 'Search query is too long'),
)

/**
 * Schema for package fetching where version is not required
 */
export const PackageRouteParamsSchema = v.object({
  packageName: PackageNameSchema,
  version: v.optional(VersionSchema),
})

/**
 * Schema for package fetching where packageName and version are required
 */
export const PackageVersionQuerySchema = v.object({
  packageName: PackageNameSchema,
  version: VersionSchema,
})

/**
 * Schema for file fetching where version and filePath are required
 */
export const PackageFileQuerySchema = v.object({
  packageName: PackageNameSchema,
  version: VersionSchema,
  filePath: FilePathSchema,
})

/**
 * Automatically infer types for routes
 * Usage - prefer this over manually defining interfaces
 */
export type PackageRouteParams = v.InferOutput<typeof PackageRouteParamsSchema>
export type PackageVersionQuery = v.InferOutput<typeof PackageVersionQuerySchema>
export type PackageFileQuery = v.InferOutput<typeof PackageFileQuerySchema>
