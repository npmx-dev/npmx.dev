import { getLatestVersion } from 'fast-npm-meta'
import { createError } from 'h3'
import validatePackageName from 'validate-npm-package-name'
import type { PackumentLicense } from '#shared/types/npm-registry'

const NPM_USERNAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i
const NPM_USERNAME_MAX_LENGTH = 50

/**
 * Encode package name for URL usage.
 * Scoped packages need special handling (@scope/name → @scope%2Fname)
 */
export function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

/**
 * Fetch the latest version of a package using fast-npm-meta API.
 * This is a lightweight alternative to fetching the full packument.
 *
 * @param name Package name
 * @returns Latest version string or null if not found
 * @see https://github.com/antfu/fast-npm-meta
 */
export async function fetchLatestVersion(name: string): Promise<string | null> {
  try {
    const meta = await getLatestVersion(name)
    return meta.version
  } catch {
    return null
  }
}

/**
 * Validate an npm package name and throw an HTTP error if invalid.
 * Uses validate-npm-package-name to check against npm naming rules.
 */
export function assertValidPackageName(name: string): void {
  const result = validatePackageName(name)
  if (!result.validForNewPackages && !result.validForOldPackages) {
    const errors = [...(result.errors ?? []), ...(result.warnings ?? [])]
    throw createError({
      // TODO: throwing 404 rather than 400 as it's cacheable
      statusCode: 404,
      message: `Invalid package name: ${errors[0] ?? 'unknown error'}`,
    })
  }
}

/**
 * Validate an npm username and throw an HTTP error if invalid.
 * Uses a regular expression to check against npm naming rules.
 */
export function assertValidUsername(username: string): void {
  if (!username || username.length > NPM_USERNAME_MAX_LENGTH || !NPM_USERNAME_RE.test(username)) {
    throw createError({
      // TODO: throwing 404 rather than 400 as it's cacheable
      statusCode: 404,
      message: `Invalid username: ${username}`,
    })
  }
}

/** Parsed result of an npm dependency version value */
export interface ParsedDependencyVersion {
  /** The real package name (different from the dependency key only for aliases) */
  name: string | null
  /** The semver range or version, null for non-resolvable values (file:, git, etc.) */
  range: string | null
}

/** Git references, e.g. `git://`, `git+ssh://`, `git+https://`, `github:user/repo` */
const GIT_REFERENCE_RE = /^(?:git(?:\+(?:ssh|https?|file))?:|github:)/
/** Tarball URLs, e.g. `https://example.com/pkg.tgz` */
const HTTP_REFERENCE_RE = /^https?:\/\//

/**
 * Check if a constraint is a non-semver value (git URL, file path, etc.)
 *
 * Matches protocols rather than bare prefixes so that dist-tags which happen to
 * start with them (`git`, `github`, `http`) are still treated as resolvable.
 */
function isNonSemverConstraint(constraint: string): boolean {
  return (
    GIT_REFERENCE_RE.test(constraint) ||
    HTTP_REFERENCE_RE.test(constraint) ||
    constraint.startsWith('file:') ||
    constraint.startsWith('link:') ||
    constraint.startsWith('workspace:') ||
    constraint.includes('/')
  )
}

/**
 * Parse a dependency version value, which may be a semver range, an npm alias,
 * or a non-semver reference.
 *
 * Examples:
 *   "^4.2.0"                    { name: null, range: "^4.2.0" }
 *   "npm:string-width@^4.2.0"   { name: "string-width", range: "^4.2.0" }
 *   "npm:@scope/pkg@^1.0.0"     { name: "@scope/pkg", range: "^1.0.0" }
 *   "file:../foo"               { name: null, range: null }
 */
export function parseDependencyVersion(value: string): ParsedDependencyVersion {
  if (value.startsWith('npm:')) {
    const aliasBody = value.slice(4) // strip "npm:"
    // Scoped: @scope/name@range
    if (aliasBody.startsWith('@')) {
      const secondAt = aliasBody.indexOf('@', 1)
      if (secondAt !== -1) {
        return { name: aliasBody.slice(0, secondAt), range: aliasBody.slice(secondAt + 1) }
      }
      return { name: aliasBody, range: null }
    }
    // Unscoped: name@range
    const atIndex = aliasBody.indexOf('@')
    if (atIndex !== -1) {
      return { name: aliasBody.slice(0, atIndex), range: aliasBody.slice(atIndex + 1) }
    }
    return { name: aliasBody, range: null }
  }

  if (isNonSemverConstraint(value)) {
    return { name: null, range: null }
  }

  return { name: null, range: value }
}

/**
 * Normalize a packument `license` field to a plain string.
 * The field can be a string or an object with a `type` property.
 *
 * @param license Raw license value from a packument
 * @returns License string, or `undefined` if not present or unrecognized
 */
export function normalizeLicense(license?: PackumentLicense): string | undefined {
  if (!license) return undefined
  if (typeof license === 'string') return license
  if (typeof license.type === 'string') return license.type
  return undefined
}
