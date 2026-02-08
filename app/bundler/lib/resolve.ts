import * as semver from 'semver'

import { progress } from '../events'

import { InvalidSpecifierError, NoMatchingVersionError } from './errors'
import { fetchPackument, reverseJsrName } from './registry'
import type {
  AbbreviatedManifest,
  PackageSpecifier,
  Registry,
  ResolvedPackage,
  ResolutionResult,
} from './types'

/**
 * parses a package specifier string into name, range, and registry.
 * handles scoped packages, JSR packages, and various formats:
 * - "foo" -> { name: "foo", range: "latest", registry: "npm" }
 * - "foo@^1.0.0" -> { name: "foo", range: "^1.0.0", registry: "npm" }
 * - "@scope/foo@~2.0.0" -> { name: "@scope/foo", range: "~2.0.0", registry: "npm" }
 * - "npm:foo@^1.0.0" -> { name: "foo", range: "^1.0.0", registry: "npm" }
 * - "jsr:@luca/flag" -> { name: "@luca/flag", range: "latest", registry: "jsr" }
 * - "jsr:@luca/flag@^1.0.0" -> { name: "@luca/flag", range: "^1.0.0", registry: "jsr" }
 *
 * @param spec the package specifier string
 * @returns parsed specifier with name, range, and registry
 */
function parseSpecifier(spec: string): PackageSpecifier {
  let registry: Registry = 'npm'
  let rest = spec

  // check for registry prefixes
  if (spec.startsWith('jsr:')) {
    registry = 'jsr'
    rest = spec.slice(4) // remove "jsr:"
  } else if (spec.startsWith('npm:')) {
    rest = spec.slice(4) // remove "npm:", registry already 'npm'
  }

  // handle scoped packages: @scope/name or @scope/name@version
  if (rest.startsWith('@')) {
    const slashIdx = rest.indexOf('/')
    if (slashIdx === -1) {
      throw new InvalidSpecifierError(spec, 'scoped package missing slash')
    }
    const atIdx = rest.indexOf('@', slashIdx)
    if (atIdx === -1) {
      return { name: rest, range: 'latest', registry }
    }
    return { name: rest.slice(0, atIdx), range: rest.slice(atIdx + 1), registry }
  }

  // JSR packages must be scoped
  if (registry === 'jsr') {
    throw new InvalidSpecifierError(spec, 'JSR packages must be scoped')
  }

  // handle regular packages: name or name@version
  const atIdx = rest.indexOf('@')
  if (atIdx === -1) {
    return { name: rest, range: 'latest', registry }
  }
  return { name: rest.slice(0, atIdx), range: rest.slice(atIdx + 1), registry }
}

/**
 * picks the best version from a packument that satisfies a range.
 * follows npm/pnpm's algorithm:
 * 1. if range is a dist-tag, use that version
 * 2. if range is empty, treat as 'latest'
 * 3. if range is a specific version (possibly with v prefix), use that
 * 4. if 'latest' tag satisfies the range, prefer it over newer versions
 * 5. otherwise, find highest non-deprecated version that satisfies the range
 * 6. fall back to deprecated version if no non-deprecated match
 *
 * @param versions available versions (version string -> manifest)
 * @param distTags dist-tags mapping (e.g., { latest: "1.2.3" })
 * @param range the version range to satisfy
 * @returns the best matching manifest, or null if none match
 */
function pickVersion(
  versions: Record<string, AbbreviatedManifest>,
  distTags: Record<string, string>,
  range: string,
): AbbreviatedManifest | null {
  // empty range means latest
  if (range === '') {
    const latest = distTags.latest
    return latest ? (versions[latest] ?? null) : null
  }

  // check if range is a dist-tag
  if (range in distTags) {
    const taggedVersion = distTags[range]
    return taggedVersion ? (versions[taggedVersion] ?? null) : null
  }

  // normalize loose version formats (v1.0.0, = 1.0.0)
  const cleanedRange = semver.validRange(range, { loose: true }) ?? range

  // check if range is an exact version
  if (versions[range]) {
    return versions[range]
  }

  // check cleaned version (handles v1.0.0 -> 1.0.0)
  const cleanedVersion = semver.clean(range, { loose: true })
  if (cleanedVersion && versions[cleanedVersion]) {
    return versions[cleanedVersion]
  }

  // for wildcard ranges, use loose mode to include prereleases
  const isWildcard = range === '*' || range === 'x' || range === ''
  const satisfiesOptions = { loose: true, includePrerelease: isWildcard }

  // prefer 'latest' tag if it satisfies the range (pnpm behavior)
  // publishers tag 'latest' intentionally, so respect that choice
  const latestVersion = distTags.latest
  if (latestVersion && versions[latestVersion]) {
    if (semver.satisfies(latestVersion, cleanedRange, satisfiesOptions)) {
      return versions[latestVersion]
    }
  }

  // find all versions satisfying the range
  const validVersions = Object.keys(versions)
    .filter(v => semver.satisfies(v, cleanedRange, satisfiesOptions))
    .sort(semver.rcompare)

  if (validVersions.length === 0) {
    return null
  }

  // prefer non-deprecated versions (pnpm behavior)
  const firstNonDeprecated = validVersions.find(v => !versions[v]?.deprecated)
  if (firstNonDeprecated) {
    return versions[firstNonDeprecated] ?? null
  }

  // fall back to deprecated if no alternatives
  const firstValid = validVersions[0]
  return firstValid ? (versions[firstValid] ?? null) : null
}

/**
 * options for dependency resolution.
 */
export interface ResolveOptions {
  /**
   * whether to auto-install peer dependencies.
   * when true, required (non-optional) peer dependencies are resolved automatically.
   * @default true
   */
  installPeers?: boolean
}

/**
 * context for tracking resolution state across recursive calls.
 */
interface ResolutionContext {
  /** all resolved packages by "registry:name@version" key for deduping */
  resolved: Map<string, ResolvedPackage>
  /** packages currently being resolved (for cycle detection) */
  resolving: Set<string>
  /** resolution options */
  options: Required<ResolveOptions>
}

/**
 * resolves a single package and its dependencies recursively.
 *
 * @param name package name
 * @param range version range to satisfy
 * @param registry which registry to fetch from
 * @param ctx resolution context for deduping and cycle detection
 * @returns the resolved package tree
 */
async function resolvePackage(
  name: string,
  range: string,
  registry: Registry,
  ctx: ResolutionContext,
): Promise<ResolvedPackage> {
  const packument = await fetchPackument(name, registry)
  const manifest = pickVersion(packument.versions, packument['dist-tags'], range)

  if (!manifest) {
    throw new NoMatchingVersionError(name, range)
  }

  progress.trigger({ type: 'progress', kind: 'resolve', name, version: manifest.version })

  const key = `${registry}:${name}@${manifest.version}`

  // check if already resolved (deduplication)
  const existing = ctx.resolved.get(key)
  if (existing) {
    return existing
  }

  // cycle detection - if we're already resolving this, return a placeholder
  // the actual dependencies will be filled in by the original resolution
  if (ctx.resolving.has(key)) {
    // create a minimal resolved package for the cycle
    const cyclic: ResolvedPackage = {
      name,
      version: manifest.version,
      tarball: manifest.dist.tarball,
      integrity: manifest.dist.integrity,
      dependencies: new Map(),
    }
    return cyclic
  }

  ctx.resolving.add(key)

  // create the resolved package
  const resolved: ResolvedPackage = {
    name,
    version: manifest.version,
    tarball: manifest.dist.tarball,
    integrity: manifest.dist.integrity,
    unpackedSize: manifest.dist.unpackedSize,
    dependencies: new Map(),
  }

  // register early so cycles can find it
  ctx.resolved.set(key, resolved)

  // collect all dependencies to resolve (regular deps + peer deps)
  const depsToResolve: Array<[string, string]> = []

  // add regular dependencies
  const deps = manifest.dependencies ?? {}
  for (const [depName, depRange] of Object.entries(deps)) {
    depsToResolve.push([depName, depRange])
  }

  // add peer dependencies as regular dependencies of this package
  // this ensures they get hoisted correctly - placed at root if no conflict,
  // or nested under this package if there's a version conflict
  if (ctx.options.installPeers && manifest.peerDependencies) {
    const peerMeta = manifest.peerDependenciesMeta ?? {}
    for (const [peerName, peerRange] of Object.entries(manifest.peerDependencies)) {
      const isOptional = peerMeta[peerName]?.optional === true
      if (!isOptional) {
        // only add if not already in regular deps (regular deps take precedence)
        if (!(peerName in deps)) {
          depsToResolve.push([peerName, peerRange])
        }
      }
    }
  }

  // resolve all dependencies in parallel
  const resolvedDeps = await Promise.all(
    depsToResolve.map(async ([depName, depRange]) => {
      // when a JSR package depends on @jsr/*, reverse to canonical name and fetch from JSR
      // otherwise use npm (even for @jsr/* from npm packages - that's what the author intended)
      let resolvedName = depName
      let depRegistry: Registry = 'npm'
      if (registry === 'jsr' && depName.startsWith('@jsr/')) {
        resolvedName = reverseJsrName(depName)
        depRegistry = 'jsr'
      }
      const dep = await resolvePackage(resolvedName, depRange, depRegistry, ctx)
      return [depName, dep] as const
    }),
  )

  for (const [depName, dep] of resolvedDeps) {
    resolved.dependencies.set(depName, dep)
  }

  ctx.resolving.delete(key)
  return resolved
}

/**
 * resolves one or more packages and all their dependencies.
 * this is the main entry point for dependency resolution.
 *
 * @param specifiers package specifiers to resolve (e.g., ["react@^18.0.0", "jsr:@luca/flag"])
 * @param options resolution options
 * @returns the full resolution result with all packages
 */
export async function resolve(
  specifiers: string[],
  options: ResolveOptions = {},
): Promise<ResolutionResult> {
  const ctx: ResolutionContext = {
    resolved: new Map(),
    resolving: new Set(),
    options: {
      installPeers: options.installPeers ?? true,
    },
  }

  const parsedSpecs = specifiers.map(parseSpecifier)

  const roots = await Promise.all(
    parsedSpecs.map(({ name, range, registry }) => resolvePackage(name, range, registry, ctx)),
  )

  return {
    roots,
    packages: ctx.resolved,
  }
}
