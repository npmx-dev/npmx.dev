import type { Packument, PackumentVersion, DependencyDepth } from '#shared/types'
import { mapWithConcurrency } from '#shared/utils/async'
import { maxSatisfying } from 'semver'

/** Concurrency limit for fetching packuments during dependency resolution */
const PACKUMENT_FETCH_CONCURRENCY = 20

/**
 * Target platform for dependency resolution.
 * We resolve for linux-x64 with glibc as a representative platform.
 */
export const TARGET_PLATFORM = {
  os: 'linux',
  cpu: 'x64',
  libc: 'glibc',
}

/**
 * Fetch packument with caching (returns null on error for tree traversal)
 */
export const fetchPackument = defineCachedFunction(
  async (name: string): Promise<Packument | null> => {
    try {
      const encodedName = name.startsWith('@')
        ? `@${encodeURIComponent(name.slice(1))}`
        : encodeURIComponent(name)

      return await $fetch<Packument>(`https://registry.npmjs.org/${encodedName}`)
    } catch (error) {
      if (import.meta.dev) {
        // oxlint-disable-next-line no-console -- log npm registry failures for debugging
        console.warn(`[dep-resolver] Failed to fetch packument for ${name}:`, error)
      }
      return null
    }
  },
  {
    maxAge: 60 * 60,
    swr: true,
    name: 'packument',
    getKey: (name: string) => name,
  },
)

/**
 * Check if a package version matches the target platform.
 * Returns false if the package explicitly excludes our target platform.
 */
export function matchesPlatform(version: PackumentVersion): boolean {
  if (version.os && Array.isArray(version.os) && version.os.length > 0) {
    const osMatch = version.os.some(os => {
      if (os.startsWith('!')) return os.slice(1) !== TARGET_PLATFORM.os
      return os === TARGET_PLATFORM.os
    })
    if (!osMatch) return false
  }

  if (version.cpu && Array.isArray(version.cpu) && version.cpu.length > 0) {
    const cpuMatch = version.cpu.some(cpu => {
      if (cpu.startsWith('!')) return cpu.slice(1) !== TARGET_PLATFORM.cpu
      return cpu === TARGET_PLATFORM.cpu
    })
    if (!cpuMatch) return false
  }

  const libc = (version as { libc?: string[] }).libc
  if (libc && Array.isArray(libc) && libc.length > 0) {
    const libcMatch = libc.some(l => {
      if (l.startsWith('!')) return l.slice(1) !== TARGET_PLATFORM.libc
      return l === TARGET_PLATFORM.libc
    })
    if (!libcMatch) return false
  }

  return true
}

/**
 * Resolve a semver range to a specific version from available versions.
 */
export function resolveVersion(range: string, versions: string[]): string | null {
  if (versions.includes(range)) return range

  // Handle npm: protocol (aliases)
  if (range.startsWith('npm:')) {
    const atIndex = range.lastIndexOf('@')
    if (atIndex > 4) {
      return resolveVersion(range.slice(atIndex + 1), versions)
    }
    return null
  }

  // Handle URLs, git refs, etc. - we can't resolve these
  if (
    range.startsWith('http://') ||
    range.startsWith('https://') ||
    range.startsWith('git://') ||
    range.startsWith('git+') ||
    range.startsWith('file:') ||
    range.includes('/')
  ) {
    return null
  }

  return maxSatisfying(versions, range)
}

/** Resolved package info */
export interface ResolvedPackage {
  name: string
  version: string
  size: number
  optional: boolean
  /** Depth level (only when trackDepth is enabled) */
  depth?: DependencyDepth
  /** Dependency path from root (only when trackDepth is enabled) */
  path?: string[]
  /** Deprecation message if the version is deprecated */
  deprecated?: string
}

/**
 * Resolve the entire dependency tree for a package.
 * Uses level-by-level BFS to ensure correct depth assignment when trackDepth is enabled.
 */
export async function resolveDependencyTree(
  rootName: string,
  rootVersion: string,
  options: { trackDepth?: boolean } = {},
): Promise<Map<string, ResolvedPackage>> {
  const resolved = new Map<string, ResolvedPackage>()
  const seen = new Set<string>()

  // Process level by level for correct depth tracking
  // Each entry includes the path of package names leading to this dependency
  let currentLevel = new Map<string, { range: string; optional: boolean; path: string[] }>([
    [rootName, { range: rootVersion, optional: false, path: [] }],
  ])
  let level = 0

  while (currentLevel.size > 0) {
    const nextLevel = new Map<string, { range: string; optional: boolean; path: string[] }>()

    // Mark all packages in current level as seen before processing
    for (const name of currentLevel.keys()) {
      seen.add(name)
    }

    // Process current level with concurrency limit
    const entries = [...currentLevel.entries()]
    await mapWithConcurrency(
      entries,
      async ([name, { range, optional, path }]) => {
        const packument = await fetchPackument(name)
        if (!packument) return

        const versions = Object.keys(packument.versions)
        const version = resolveVersion(range, versions)
        if (!version) return

        const versionData = packument.versions[version]
        if (!versionData) return

        if (!matchesPlatform(versionData)) return

        const size = (versionData.dist as { unpackedSize?: number })?.unpackedSize ?? 0
        const key = `${name}@${version}`

        // Build path for this package (path to parent + this package with version)
        const currentPath = [...path, `${name}@${version}`]

        if (!resolved.has(key)) {
          const pkg: ResolvedPackage = { name, version, size, optional }
          if (options.trackDepth) {
            pkg.depth = level === 0 ? 'root' : level === 1 ? 'direct' : 'transitive'
            pkg.path = currentPath
          }
          if (versionData.deprecated) {
            pkg.deprecated = versionData.deprecated
          }
          resolved.set(key, pkg)
        }

        // Collect dependencies for next level
        if (versionData.dependencies) {
          for (const [depName, depRange] of Object.entries(versionData.dependencies)) {
            if (!seen.has(depName) && !nextLevel.has(depName)) {
              nextLevel.set(depName, { range: depRange, optional: false, path: currentPath })
            }
          }
        }

        // Collect optional dependencies
        if (versionData.optionalDependencies) {
          for (const [depName, depRange] of Object.entries(versionData.optionalDependencies)) {
            if (!seen.has(depName) && !nextLevel.has(depName)) {
              nextLevel.set(depName, { range: depRange, optional: true, path: currentPath })
            }
          }
        }
      },
      PACKUMENT_FETCH_CONCURRENCY,
    )

    currentLevel = nextLevel
    level++
  }

  return resolved
}
