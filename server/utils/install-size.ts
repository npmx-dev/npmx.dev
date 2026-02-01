/**
 * Result of install size calculation
 */
export interface InstallSizeResult {
  /** Package name */
  package: string
  /** Package version */
  version: string
  /** Unpacked size of the package itself (bytes) */
  selfSize: number
  /** Total unpacked size including all dependencies (bytes) */
  totalSize: number
  /** Number of dependencies (including transitive) */
  dependencyCount: number
  /** Breakdown of dependency sizes */
  dependencies: DependencySize[]
}

export interface DependencySize {
  name: string
  version: string
  size: number
  /** True if this is an optional dependency */
  optional?: boolean
}

/**
 * Calculate the total install size for a package.
 *
 * Resolves dependencies by fetching packuments directly from the npm registry.
 * No filesystem operations - safe for serverless environments.
 *
 * Dependencies are resolved for linux-x64-glibc as a representative platform.
 */
export const calculateInstallSize = defineCachedFunction(
  async (name: string, version: string): Promise<InstallSizeResult> => {
    const resolved = await resolveDependencyTree(name, version)

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
  },
  {
    // Cache for 1 hour - dependency resolutions can change with new releases
    maxAge: 60 * 60,
    swr: true,
    name: 'install-size',
    getKey: (name: string, version: string) => `${name}@${version}`,
  },
)
