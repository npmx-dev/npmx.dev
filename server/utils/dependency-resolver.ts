import { mapWithConcurrency } from '#shared/utils/async'
import { parseDependencyVersion } from '#shared/utils/npm'
import { findMaxSatisfying, findMinSatisfying, isGreater, isStable } from 'verkit'

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
 * Fetch abbreviated packument metadata for tree traversal (returns null on error).
 * Only install-relevant fields are needed here, so this uses the much smaller abbreviated
 * document rather than the full packument.
 */
async function fetchPackument(name: string): Promise<AbbreviatedPackument | null> {
  try {
    return await fetchNpmPackageAbbreviated(name)
  } catch (error) {
    if (import.meta.dev) {
      // oxlint-disable-next-line no-console -- log npm registry failures for debugging
      console.warn(`[dep-resolver] Failed to fetch packument for ${name}:`, error)
    }
    return null
  }
}

/** The subset of version fields used to decide platform compatibility. */
interface PlatformRestrictions {
  os?: string[]
  cpu?: string[]
  libc?: string[]
}

/**
 * Check if a package version matches the target platform.
 * Returns false if the package explicitly excludes our target platform.
 */
export function matchesPlatform(version: PlatformRestrictions): boolean {
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

  const libc = version.libc
  if (libc && Array.isArray(libc) && libc.length > 0) {
    const libcMatch = libc.some(l => {
      if (l.startsWith('!')) return l.slice(1) !== TARGET_PLATFORM.libc
      return l === TARGET_PLATFORM.libc
    })
    if (!libcMatch) return false
  }

  return true
}

function parsePublishTime(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * Compute the timestamp that a given version's dependency tree should be
 * resolved at, similar to pnpm's `--before`. Returns `undefined` to indicate that
 * the resolution limit cannot be determined and the caller should fall back to the
 * latest possible versions.
 *
 * This allows computing the dependencies size of an older version at the time
 * that that version was last the current one.
 *
 * The limit is the first release published after this one that is also greater
 * in semver order, so parallel release lines don't freeze each other. If a package
 * publishes (in order) 1.0.0, 2.0.0, 3.0.0, 2.1.0, 1.1.0, then 3.0.0 will not be
 * limited by 2.1.0 and 2.1.0 will not be limited by 1.1.0.
 *
 * Prereleases are not counted as superseding a stable release, since an install
 * keeps resolving to the stable one: 1.0.0 is limited by 1.1.0, not by the
 * 1.1.0-beta.1 that may have come months earlier.
 *
 * Monorepos publish a release over a few minutes, so the limit is moved
 * `RESOLUTION_GRACE_MS` before the next release and never earlier than
 * `RESOLUTION_GRACE_MS` after this one. When the next release follows within that
 * grace period, the limit therefore falls after it, and dependency releases
 * published in between are still included.
 *
 * Throws when the publish times cannot be fetched, so that a size resolved
 * against today's registry is never cached as frozen history.
 */
export async function getDependenciesResolutionLimit(
  name: string,
  version: string,
): Promise<number | undefined> {
  const meta = await fetchNpmPackageVersionsMeta(name)
  // A fully unpublished package still has a `time` (carrying `unpublished`) but
  // no `versions` at all.
  if (!meta?.time || !meta.versions.length) return undefined

  return getDependenciesResolutionLimitPure(version, meta.versions, meta.time, meta.distTags.latest)
}

export const RESOLUTION_GRACE_MS = 5 * 60 * 1000

export function getDependenciesResolutionLimitPure(
  version: string,
  versions: string[],
  versionsTimes: Record<string, string>,
  latestVersion?: string,
): number | undefined {
  // `latest` is not frozen yet, and it keeps using the most recent version of
  // its dependencies.
  if (version === latestVersion) return undefined

  const publishedAt = parsePublishTime(versionsTimes[version])
  if (publishedAt === undefined) return undefined

  let next: number | undefined
  for (const candidate of versions) {
    if (candidate === version) continue
    if (!isGreater(candidate, version)) continue
    if (isStable(version) && !isStable(candidate)) continue
    const candidateTime = parsePublishTime(versionsTimes[candidate])
    if (candidateTime === undefined || candidateTime <= publishedAt) continue
    if (next === undefined || candidateTime < next) next = candidateTime
  }

  if (next === undefined) return undefined

  return Math.max(next - RESOLUTION_GRACE_MS, publishedAt + RESOLUTION_GRACE_MS)

  // Why do we need this Math.max + RESOLUTION_GRACE_MS above? Good question :)
  //
  // When publishing monorepo packages their timing gets mixed up a little bit by
  // npm. For example:
  //
  //     --- Babel 8.0.5
  //        0s  @babel/types      21:12:34
  //       +5s  @babel/parser     21:12:39
  //      +43s  @babel/traverse   21:13:16
  //      +45s  @babel/core       21:13:19
  //      +71s  @babel/generator  21:13:44
  //     --- Babel 8.0.6
  //        0s  @babel/generator  13:47:44
  //      +27s  @babel/core       13:48:10
  //      +75s  @babel/traverse   13:48:59
  //     +100s  @babel/parser     13:49:23
  //     +185s  @babel/types      13:50:49
  //
  // We want that `@babel/core@8.0.5` to consider `@babel/generator@8.0.5` as its
  // latest good dependency, even though technically `@babel/generator@8.0.6` was
  // released before `@babel/core@8.0.5`. So we want to return not `next`, but
  // `next - RESOLUTION_GRACE_MS`.
  //
  // We cannot _just_ return `next - RESOLUTION_GRACE_MS` however, because what if
  // a package has two consecutive releases within the grace period? We don't want
  // to limit the oder version's dependencies to too far in the past! So we need to
  // do `max(next - RESOLUTION_GRACE_MS, publishedAt)`.
  //
  // That is still not enough: if the Babel 8.0.5 and 8.0.6 releases were close enough
  // that the `max` trigger and it returns `publishedAt`, we want `@babel/core@8.0.5` to
  // be able to depend on `@babel/generator@8.0.5` even though it was published slightly
  // later than `publishedAt`, so we use `publishedAt + RESOLUTION_GRACE_MS` instead.
}

/**
 * Resolve a semver range to a specific version from available versions.
 *
 * When `before` is set, only versions published at or before that timestamp are
 * considered. An exact version is always respected, regardless of its publish time.
 * If no such version satisfies the range, the lowest version that does is used, which
 * is the first one that became available after `before`.
 */
export function resolveVersion(
  range: string,
  versions: string[],
  options: { before?: number; versionsTimes?: Record<string, string> } = {},
): string | null {
  if (versions.includes(range)) return range

  // Handle npm: protocol (aliases)
  if (range.startsWith('npm:')) {
    const atIndex = range.lastIndexOf('@')
    if (atIndex > 4) {
      return resolveVersion(range.slice(atIndex + 1), versions, options)
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

  const { before, versionsTimes } = options
  if (before === undefined || !versionsTimes) {
    return findMaxSatisfying(versions, range)
  }

  const eligible = versions.filter(version => {
    const published = parsePublishTime(versionsTimes[version])
    // Old packages didn't have a publish time, keep them.
    return published === undefined || published <= before
  })

  // Nothing in range was published yet, e.g. a monorepo sibling published moments
  // after its dependent. Keep the dependency, with the first release that came after.
  return findMaxSatisfying(eligible, range) ?? findMinSatisfying(versions, range)
}

/** Resolved package info */
export interface ResolvedPackage {
  name: string
  version: string
  size: number
  tarballUrl: string
  optional: boolean
  /** Depth level (only when trackDepth is enabled) */
  depth?: DependencyDepth
  /** Dependency path from root (only when trackDepth is enabled) */
  path?: string[]
  /** Deprecation message if the version is deprecated */
  deprecated?: string
}

type DependencyRequest = {
  name: string
  range: string
  optional: boolean
  path: string[]
}

function requestKey(name: string, range: string): string {
  // Match the alias-range extraction used by resolveVersion.
  if (range.startsWith('npm:')) {
    const atIndex = range.lastIndexOf('@')
    if (atIndex > 4) {
      range = range.slice(atIndex + 1)
    }
  }

  return JSON.stringify([name, range])
}

/**
 * Resolve the entire dependency tree for a package.
 * Uses level-by-level BFS to ensure correct depth assignment when trackDepth is enabled.
 *
 * Pass `before` (see {@link getDependenciesResolutionLimit}) to resolve the tree as it
 * was at a point in the past rather than against today's registry.
 */
export async function resolveDependencyTree(
  rootName: string,
  rootVersion: string,
  options: { trackDepth?: boolean; before?: number } = {},
): Promise<Map<string, ResolvedPackage>> {
  const resolved = new Map<string, ResolvedPackage>()
  const seen = new Set<string>()

  // Process level by level for correct depth tracking
  // Each entry includes the path of package names leading to this dependency
  let currentLevel = new Map<string, DependencyRequest>([
    [
      requestKey(rootName, rootVersion),
      { name: rootName, range: rootVersion, optional: false, path: [] },
    ],
  ])
  let level = 0

  while (currentLevel.size > 0) {
    const nextLevel = new Map<string, DependencyRequest>()

    // Mark all packages in current level as seen before processing
    for (const key of currentLevel.keys()) {
      seen.add(key)
    }

    // Process current level with concurrency limit
    const entries = [...currentLevel.values()]
    await mapWithConcurrency(
      entries,
      async ({ name, range, optional, path }) => {
        const [packument, versionsMeta] = await Promise.all([
          fetchPackument(name),
          // Let a failure reject the whole tree, so that it isn't cached as frozen history.
          options.before === undefined ? null : fetchNpmPackageVersionsMeta(name),
        ])
        if (!packument) return

        // With `before`, only pick from the versions the publish times were read with: a
        // release newer than that snapshot has no publish time and would pass as an old one.
        // Exact pins are still honoured, like `resolveVersion` does.
        const snapshot = versionsMeta && new Set(versionsMeta.versions)
        const versions = Object.keys(packument.versions).filter(
          version => !snapshot || snapshot.has(version) || version === range,
        )
        const version = resolveVersion(range, versions, {
          before: options.before,
          versionsTimes: versionsMeta?.time,
        })
        if (!version) return

        let versionData = packument.versions[version]
        if (!versionData) return

        // `os`/`cpu` come from the abbreviated metadata; reject mismatches before paying for
        // the separate libc lookup.
        if (!matchesPlatform({ os: versionData.os, cpu: versionData.cpu })) return

        // The registry omits `libc` from abbreviated metadata, but it can still exclude a
        // version (e.g. musl-only builds on a glibc target), so read it from the small
        // single-version manifest.
        if (versionData.libc === undefined && (versionData.os?.length || versionData.cpu?.length)) {
          try {
            const libc = await fetchNpmPackageVersionLibc(name, version)
            if (libc) versionData = { ...versionData, libc }
          } catch {
            // libc lookup failed: skip optional deps, keep required ones.
            if (optional) return
          }
        }

        if (!matchesPlatform(versionData)) return

        const size = versionData.dist?.unpackedSize ?? 0
        const tarballUrl = versionData.dist?.tarball ?? ''
        const key = `${name}@${version}`

        // Build path for this package (path to parent + this package with version)
        const currentPath = [...path, key]

        const existing = resolved.get(key)
        if (existing) {
          if (!optional) existing.optional = false
        } else {
          const pkg: ResolvedPackage = { name, version, size, tarballUrl, optional }
          if (options.trackDepth) {
            pkg.depth = level === 0 ? 'root' : level === 1 ? 'direct' : 'transitive'
            pkg.path = currentPath
          }
          if (versionData.deprecated) {
            pkg.deprecated = versionData.deprecated
          }
          resolved.set(key, pkg)
        }

        // Collect dependencies for next level.
        // An npm alias ("npm:pkg@range") is resolved against the aliased package, not the dependency key.
        if (versionData.dependencies) {
          for (const [depKey, depRange] of Object.entries(versionData.dependencies)) {
            const depName = parseDependencyVersion(depRange).name ?? depKey
            const reqKey = requestKey(depName, depRange)
            const queued = nextLevel.get(reqKey)

            if (queued) {
              // A required request upgrades a queued optional request.
              queued.optional = false
            } else if (!seen.has(reqKey)) {
              nextLevel.set(reqKey, {
                name: depName,
                range: depRange,
                optional: false,
                path: currentPath,
              })
            }
          }
        }

        // Collect optional dependencies
        if (versionData.optionalDependencies) {
          for (const [depKey, depRange] of Object.entries(versionData.optionalDependencies)) {
            const depName = parseDependencyVersion(depRange).name ?? depKey
            const reqKey = requestKey(depName, depRange)

            if (!seen.has(reqKey) && !nextLevel.has(reqKey)) {
              nextLevel.set(reqKey, {
                name: depName,
                range: depRange,
                optional: true,
                path: currentPath,
              })
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
