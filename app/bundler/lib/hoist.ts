import type { HoistedNode, HoistedResult, ResolvedPackage } from './types'

/**
 * creates a hoisted node from a resolved package.
 */
function createNode(pkg: ResolvedPackage): HoistedNode {
  return {
    name: pkg.name,
    version: pkg.version,
    tarball: pkg.tarball,
    integrity: pkg.integrity,
    unpackedSize: pkg.unpackedSize,
    dependencyCount: pkg.dependencies.size,
    nested: new Map(),
  }
}

/**
 * attempts to place a package at the root level.
 * returns true if placement succeeded, false if there's a conflict.
 *
 * a conflict occurs when:
 * - a different version of the same package is already at root
 *
 * @param root the current root node_modules map
 * @param pkg the package to place
 * @returns true if placed at root, false if needs nesting
 */
function tryPlaceAtRoot(root: Map<string, HoistedNode>, pkg: ResolvedPackage): boolean {
  const existing = root.get(pkg.name)

  if (!existing) {
    // no conflict, place at root
    root.set(pkg.name, {
      name: pkg.name,
      version: pkg.version,
      tarball: pkg.tarball,
      integrity: pkg.integrity,
      unpackedSize: pkg.unpackedSize,
      dependencyCount: pkg.dependencies.size,
      nested: new Map(),
    })
    return true
  }

  // same version already at root - reuse it
  if (existing.version === pkg.version) {
    return true
  }

  // different version - conflict, needs nesting
  return false
}

/**
 * hoists dependencies as high as possible in the tree.
 * follows npm's placement algorithm:
 * 1. explicitly requested (root) packages always get placed at root
 * 2. transitive dependencies try to hoist to root
 * 3. if conflict with a root package, nest under parent
 *
 * peer dependencies are handled by the resolver - they're added as regular
 * dependencies of the package that requested them, so they naturally get
 * hoisted to root if no conflict, or nested under the dependent if there's
 * a version conflict. this ensures the bundler resolves peers correctly.
 *
 * @param roots the root packages from resolution
 * @returns the hoisted node_modules structure
 */
export function hoist(roots: ResolvedPackage[]): HoistedResult {
  const root = new Map<string, HoistedNode>()

  // track which packages we've visited to avoid infinite loops
  const visited = new Set<string>()

  // track which package names are explicitly requested (root packages)
  // these take precedence over transitive dependencies
  const rootPackageVersions = new Map<string, string>()
  for (const pkg of roots) {
    rootPackageVersions.set(pkg.name, pkg.version)
  }

  /**
   * recursively process a package's dependencies.
   * the package itself should already be placed.
   */
  function processDependencies(pkg: ResolvedPackage, node: HoistedNode): void {
    for (const dep of pkg.dependencies.values()) {
      const depKey = `${dep.name}@${dep.version}`

      // skip if already processed
      if (visited.has(depKey)) {
        continue
      }
      visited.add(depKey)

      // check if this dep conflicts with a root package
      const rootVersion = rootPackageVersions.get(dep.name)
      if (rootVersion !== undefined && rootVersion !== dep.version) {
        // conflict with explicit root package - must nest
        const nestedNode = createNode(dep)
        node.nested.set(dep.name, nestedNode)
        processDependencies(dep, nestedNode)
        continue
      }

      // try to place at root
      const placedAtRoot = tryPlaceAtRoot(root, dep)
      if (placedAtRoot) {
        const rootNode = root.get(dep.name)!
        processDependencies(dep, rootNode)
      } else {
        // conflict at root with another transitive dep - nest
        const nestedNode = createNode(dep)
        node.nested.set(dep.name, nestedNode)
        processDependencies(dep, nestedNode)
      }
    }
  }

  // first pass: place all root packages at root level
  // this ensures explicitly requested packages take precedence
  for (const rootPkg of roots) {
    const key = `${rootPkg.name}@${rootPkg.version}`
    if (visited.has(key)) {
      continue
    }
    visited.add(key)

    // root packages always go at root (overwrite if different version exists)
    const node = createNode(rootPkg)
    root.set(rootPkg.name, node)
  }

  // second pass: process dependencies of all root packages
  for (const rootPkg of roots) {
    const node = root.get(rootPkg.name)
    if (node) {
      processDependencies(rootPkg, node)
    }
  }

  return { root }
}
