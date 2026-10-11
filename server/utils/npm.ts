import { findMaxSatisfying } from 'verkit'

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

/** Registry media type for the abbreviated ("install") packument. */
const NPM_INSTALL_V1 = 'application/vnd.npm.install-v1+json'

/**
 * Fetch abbreviated packument metadata — the much smaller document `npm install` uses.
 * Only install-relevant fields are present; use `fetchNpmPackage` when full-document fields
 * (time, license, readme, …) are needed. Kept in a separate cache namespace from
 * `fetchNpmPackage` because the shapes differ.
 */
export const fetchNpmPackageAbbreviated = defineCachedFunction(
  async (name: string): Promise<AbbreviatedPackument> => {
    const encodedName = encodePackageName(name)
    return await $fetch<AbbreviatedPackument>(`${NPM_REGISTRY}/${encodedName}`, {
      headers: { accept: NPM_INSTALL_V1 },
    })
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    name: 'npm-package-abbreviated',
    getKey: (name: string) => name,
  },
)

/**
 * The registry omits `libc` from abbreviated metadata, so read it from a single version's
 * manifest (small). Only needed for platform-restricted versions — e.g. to tell glibc and
 * musl builds of the same os/cpu apart.
 */
export const fetchNpmPackageVersionLibc = defineCachedFunction(
  async (name: string, version: string): Promise<string[] | undefined> => {
    const encodedName = encodePackageName(name)
    const manifest = await $fetch<{ libc?: string[] }>(
      `${NPM_REGISTRY}/${encodedName}/${encodeURIComponent(version)}`,
    )
    return manifest.libc
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    name: 'npm-version-libc',
    getKey: (name: string, version: string) => `${name}@${version}`,
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

  // Fallback to abbreviated packument (also cached)
  try {
    const packument = await fetchNpmPackageAbbreviated(name)
    return packument['dist-tags']?.latest ?? null
  } catch {
    return null
  }
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
    const packument = await fetchNpmPackageAbbreviated(packageName)
    const versions = Object.keys(packument.versions)
    return findMaxSatisfying(versions, constraint)
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
