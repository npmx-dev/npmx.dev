import type { InstalledPackage, PackageRef } from '../types'

import type { ResolvedPackage } from './types'

/**
 * builds the installed packages list from the resolved dependency tree.
 * also identifies which packages are only reachable through peer dependencies.
 *
 * @param root the root resolved package
 * @param peerDepNames names of the root package's peer dependencies
 * @returns array of installed packages with peer status
 */
export function buildInstalledPackages(
  root: ResolvedPackage,
  peerDepNames: Set<string>,
): InstalledPackage[] {
  // collect all unique packages and compute levels
  const packageMap = new Map<
    string,
    {
      pkg: ResolvedPackage
      level: number
      dependents: PackageRef[]
      dependencies: PackageRef[]
    }
  >()

  // track which packages are reachable without going through peer deps
  const reachableWithoutPeers = new Set<string>()

  // first pass: collect packages and compute levels
  {
    const visited = new Set<string>()

    function walk(pkg: ResolvedPackage, level: number, inPeerSubtree: boolean): void {
      const key = `${pkg.name}@${pkg.version}`

      // update level to shortest path
      const existing = packageMap.get(key)
      if (existing) {
        if (level < existing.level) {
          existing.level = level
        }
      } else {
        packageMap.set(key, { pkg, level, dependents: [], dependencies: [] })
      }

      // track if reachable without peers
      if (!inPeerSubtree) {
        reachableWithoutPeers.add(key)
      }

      // avoid infinite loops from cycles
      if (visited.has(key)) {
        return
      }
      visited.add(key)

      for (const [depName, dep] of pkg.dependencies) {
        // check if this edge goes through a root peer dep
        const isPeerEdge = pkg === root && peerDepNames.has(depName)
        walk(dep, level + 1, inPeerSubtree || isPeerEdge)
      }

      visited.delete(key)
    }

    walk(root, 0, false)
  }

  // second pass: build dependency/dependent relationships
  // we need to read peerDependencies from each package's manifest
  for (const [_key, entry] of packageMap) {
    const pkg = entry.pkg

    for (const [depName, dep] of pkg.dependencies) {
      const depKey = `${dep.name}@${dep.version}`
      const depEntry = packageMap.get(depKey)
      if (!depEntry) {
        continue
      }

      // check if this is a peer dependency edge by looking at the manifest
      // note: during resolution, peer deps are added to dependencies map
      // we need to check the original peerDependencies field
      const isPeerDep = pkg === root && peerDepNames.has(depName)

      // add to this package's dependencies
      entry.dependencies.push({
        name: dep.name,
        version: dep.version,
        isPeer: isPeerDep,
      })

      // add to the dependency's dependents
      depEntry.dependents.push({
        name: pkg.name,
        version: pkg.version,
        isPeer: isPeerDep,
      })
    }
  }

  // build final array
  const packages: InstalledPackage[] = []
  for (const [key, { pkg, level, dependents, dependencies }] of packageMap) {
    // a package is a peer if:
    // 1. it's a direct peer dependency of the root, OR
    // 2. it's only reachable through peer dependency subtrees
    const isDirectPeerOfRoot = peerDepNames.has(pkg.name)
    const isOnlyReachableThroughPeers = !reachableWithoutPeers.has(key)

    packages.push({
      name: pkg.name,
      version: pkg.version,
      size: pkg.unpackedSize ?? 0,
      path: `node_modules/${pkg.name}`,
      level,
      dependents,
      dependencies,
      isPeer: isDirectPeerOfRoot || isOnlyReachableThroughPeers,
    })
  }

  return packages
}
