import type { Packument } from '#shared/types'
import { maxSatisfying, prerelease } from 'semver'

const NPM_REGISTRY = 'https://registry.npmjs.org'

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

export const fetchNpmPackage = defineCachedFunction(
  async (name: string): Promise<Packument> => {
    const encodedName = encodePackageName(name)
    return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
  },
  {
    maxAge: 60 * 5,
    swr: true,
    name: 'npm-package',
    getKey: (name: string) => name,
  },
)

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
