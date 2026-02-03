import type { Packument, NpmSearchResponse } from '#shared/types'
import { encodePackageName, fetchLatestVersion } from '#shared/utils/npm'
import { maxSatisfying, prerelease } from 'semver'
import { CACHE_MAX_AGE_FIVE_MINUTES } from '#shared/utils/constants'

const NPM_REGISTRY = 'https://registry.npmjs.org'

export const fetchNpmPackage = defineCachedFunction(
  async (name: string): Promise<Packument> => {
    const encodedName = encodePackageName(name)
    return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    name: 'npm-package',
    getKey: (name: string) => name,
  },
)

/**
 * Get the latest version of a package using fast-npm-meta API.
 * Falls back to full packument if fast-npm-meta fails.
 *
 * @param name Package name
 * @returns Latest version string or null if not found
 */
export async function fetchLatestVersionWithFallback(name: string): Promise<string | null> {
  const version = await fetchLatestVersion(name)
  if (version) return version

  // Fallback to full packument (also cached)
  try {
    const packument = await fetchNpmPackage(name)
    return packument['dist-tags']?.latest ?? null
  } catch {
    return null
  }
}

/**
 * Check if a version constraint explicitly includes a prerelease tag.
 * e.g., "^1.0.0-alpha" or ">=2.0.0-beta.1" include prereleases
 */
function constraintIncludesPrerelease(constraint: string): boolean {
  // Look for prerelease identifiers in the constraint
  return (
    /-(alpha|beta|rc|next|canary|dev|preview|pre|experimental)/i.test(constraint) ||
    /-\d/.test(constraint)
  ) // e.g., -0, -1
}

/**
 * Resolve a semver version constraint to the best matching version.
 * Returns the highest version that satisfies the constraint, or null if none match.
 *
 * By default, excludes prerelease versions unless the constraint explicitly
 * includes a prerelease tag (e.g., "^1.0.0-beta").
 */
export async function resolveVersionConstraint(
  packageName: string,
  constraint: string,
): Promise<string | null> {
  try {
    const packument = await fetchNpmPackage(packageName)
    let versions = Object.keys(packument.versions)

    // Filter out prerelease versions unless constraint explicitly includes one
    if (!constraintIncludesPrerelease(constraint)) {
      versions = versions.filter(v => !prerelease(v))
    }

    return maxSatisfying(versions, constraint)
  } catch {
    return null
  }
}

/**
 * Resolve multiple dependency constraints to their best matching versions.
 * Returns a map of package name to resolved version.
 */
export async function resolveDependencyVersions(
  dependencies: Record<string, string>,
): Promise<Record<string, string>> {
  const entries = Object.entries(dependencies)
  const results = await Promise.all(
    entries.map(async ([name, constraint]) => {
      const resolved = await resolveVersionConstraint(name, constraint)
      return [name, resolved] as const
    }),
  )

  const resolved: Record<string, string> = {}
  for (const [name, version] of results) {
    if (version) {
      resolved[name] = version
    }
  }
  return resolved
}

/**
 * Find a user's email address from its username
 * by exploring metadata in its public packages
 */
export const fetchUserEmail = defineCachedFunction(
  async (username: string): Promise<string | null> => {
    const handle = username.trim()
    if (!handle) return null

    // Fetch packages with the user's handle as a maintainer
    const params = new URLSearchParams({
      text: `maintainer:${handle}`,
      size: '20',
    })
    const response = await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params}`)
    const lowerHandle = handle.toLowerCase()

    // Search for the user's email in packages metadata
    for (const result of response.objects) {
      const maintainers = result.package.maintainers ?? []
      const match = maintainers.find(
        person =>
          person.username?.toLowerCase() === lowerHandle ||
          person.name?.toLowerCase() === lowerHandle,
      )
      if (match?.email) {
        return match.email
      }
    }

    return null
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    name: 'npm-user-email',
    getKey: (username: string) => `npm-user-email:${username.trim().toLowerCase()}`,
  },
)
