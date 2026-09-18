export function parseFrozenHistory(value: unknown): boolean {
  return value === 'true'
}

async function calculateInstallSizeUncached(
  name: string,
  version: string,
  before?: number,
): Promise<InstallSizeResult> {
  const resolved = await resolveDependencyTree(name, version, { before })

  // Separate self from dependencies
  const selfKey = `${name}@${version}`
  const selfEntry = resolved.get(selfKey)
  const selfSize = selfEntry?.size ?? 0

  // Build dependencies list (excluding self)
  const dependencies: DependencySize[] = []
  let totalSize = selfSize
  let dependencyCount = 0

  for (const [key, dep] of resolved) {
    if (key === selfKey) continue

    dependencies.push({
      name: dep.name,
      version: dep.version,
      size: dep.size,
      tarballUrl: dep.tarballUrl,
      optional: dep.optional || undefined,
    })
    totalSize += dep.size
    dependencyCount++
  }

  // Sort by size descending
  dependencies.sort((a, b) => b.size - a.size)

  return {
    package: name,
    version,
    selfSize,
    totalSize,
    dependencyCount,
    dependencies,
  }
}

/** Install size resolved against the registry as it is right now. */
const calculateCurrentInstallSize = defineCachedFunction(calculateInstallSizeUncached, {
  // Cache for 1 hour - dependency resolutions can change with new releases
  maxAge: CACHE_MAX_AGE_ONE_HOUR,
  swr: true,
  name: 'install-size',
  getKey: (name: string, version: string) => `${name}@${version}`,
})

/**
 * Install size resolved as of a past timestamp. Use a longer cache key because
 * these results are effectively immutable.
 * We could use something even longer, like one year, but one day allows us to
 * easily refresh the cache if there is some mistake in our logic :)
 */
const calculateHistoricalInstallSize = defineCachedFunction(calculateInstallSizeUncached, {
  maxAge: CACHE_MAX_AGE_ONE_DAY,
  swr: true,
  name: 'install-size-history',
  getKey: (name: string, version: string, before?: number) => `v1:${name}@${version}:${before}`,
})

/**
 * Calculate the total install size for a package.
 *
 * Pass the `before` from `getDependenciesResolutionLimit()` to get the size of
 * an older package version using versions of dependencies that were available
 * at that time.
 */
export function calculateInstallSize(
  name: string,
  version: string,
  before?: number,
): Promise<InstallSizeResult> {
  return before === undefined
    ? calculateCurrentInstallSize(name, version)
    : calculateHistoricalInstallSize(name, version, before)
}
