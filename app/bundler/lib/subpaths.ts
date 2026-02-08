import type { Volume } from 'memfs'

import type { DiscoveredSubpaths, Subpath } from '../types'

import type { PackageExports, PackageJson } from './types'

// #region condition resolution

/**
 * condition priority for ESM browser bundling.
 * higher index = higher priority.
 */
const CONDITION_PRIORITY = ['default', 'module', 'import', 'browser'] as const

/**
 * resolves a conditional export to a file path.
 * handles nested conditions and returns the best match for ESM browser.
 */
function resolveCondition(value: PackageExports): string | null {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    // array means "try in order", take first
    for (const item of value) {
      const resolved = resolveCondition(item)
      if (resolved) {
        return resolved
      }
    }
    return null
  }

  if (typeof value === 'object') {
    // check if this is a conditions object or a subpath object
    const keys = Object.keys(value)

    // if any key starts with '.', this is a subpath object, not conditions
    if (keys.some(k => k.startsWith('.'))) {
      return null
    }

    // this is a conditions object, find best match
    let bestMatch: string | null = null
    let bestPriority = -1

    for (const [condition, target] of Object.entries(value)) {
      const priority = CONDITION_PRIORITY.indexOf(condition as (typeof CONDITION_PRIORITY)[number])

      if (priority > bestPriority) {
        const resolved = resolveCondition(target as PackageExports)
        if (resolved) {
          bestMatch = resolved
          bestPriority = priority
        }
      }
    }

    return bestMatch
  }

  return null
}

// #endregion

// #region wildcard expansion

/**
 * recursively lists all files in a directory.
 */
function listFilesRecursive(volume: Volume, dir: string): string[] {
  const files: string[] = []

  try {
    const entries = volume.readdirSync(dir, { withFileTypes: true }) as {
      name: string
      isDirectory(): boolean
      isFile(): boolean
    }[]
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`
      if (entry.isDirectory()) {
        files.push(...listFilesRecursive(volume, fullPath))
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  } catch {
    // directory doesn't exist or can't be read
  }

  return files
}

/**
 * expands a wildcard pattern against the volume files.
 *
 * @param subpath the subpath pattern with wildcard (e.g., "./*")
 * @param target the target pattern (e.g., "./*.js")
 * @param packagePath the package path in volume (e.g., "/node_modules/pkg")
 * @param volume the volume to search in
 * @returns expanded subpath entries
 */
function expandWildcard(
  subpath: string,
  target: string,
  packagePath: string,
  volume: Volume,
): Subpath[] {
  const entries: Subpath[] = []

  // extract the parts before and after the wildcard
  const targetParts = target.split('*')
  if (targetParts.length !== 2) {
    // invalid pattern, skip
    return entries
  }

  const prefix = targetParts[0]!
  const suffix = targetParts[1]!
  const subpathParts = subpath.split('*')
  if (subpathParts.length !== 2) {
    return entries
  }

  const subpathPrefix = subpathParts[0]!
  const subpathSuffix = subpathParts[1]!

  // normalize the prefix to match volume paths
  // target like "./src/*.js" becomes "/node_modules/pkg/src"
  const searchDir = `${packagePath}/${prefix.replace(/^\.\//, '').replace(/\/$/, '')}`

  // list all files in the search directory
  const allFiles = listFilesRecursive(volume, searchDir)

  for (const filePath of allFiles) {
    // check if file matches the pattern
    const relativePath = filePath.slice(searchDir.length + 1)

    if (suffix && !filePath.endsWith(suffix)) {
      continue
    }

    // extract the wildcard match
    const match = suffix ? relativePath.slice(0, relativePath.length - suffix.length) : relativePath

    // construct the subpath
    const expandedSubpath = `${subpathPrefix}${match}${subpathSuffix}`

    // construct the relative target
    const expandedTarget = `./${prefix.replace(/^\.\//, '')}${match}${suffix}`

    entries.push({
      subpath: expandedSubpath,
      target: expandedTarget,
      isWildcard: true,
    })
  }

  return entries
}

// #endregion

// #region main discovery

/**
 * discovers all available subpaths from a package's exports field.
 *
 * @param packageJson the package.json content
 * @param volume the volume containing package files
 * @returns discovered subpaths with default selection
 */
export function discoverSubpaths(packageJson: PackageJson, volume: Volume): DiscoveredSubpaths {
  const entries: Subpath[] = []
  const packagePath = `/node_modules/${packageJson.name}`

  // check for exports field first (takes precedence)
  if (packageJson.exports !== undefined) {
    const exportsField = packageJson.exports

    if (typeof exportsField === 'string') {
      // simple string export: "exports": "./index.js"
      entries.push({
        subpath: '.',
        target: exportsField,
        isWildcard: false,
      })
    } else if (Array.isArray(exportsField)) {
      // array export: "exports": ["./index.js", "./index.cjs"]
      const resolved = resolveCondition(exportsField)
      if (resolved) {
        entries.push({
          subpath: '.',
          target: resolved,
          isWildcard: false,
        })
      }
    } else if (typeof exportsField === 'object' && exportsField !== null) {
      // object export - could be conditions or subpaths
      const keys = Object.keys(exportsField)
      const hasSubpaths = keys.some(k => k.startsWith('.'))

      if (hasSubpaths) {
        // subpath exports
        for (const [subpath, value] of Object.entries(exportsField)) {
          if (!subpath.startsWith('.')) {
            continue
          }

          if (subpath.includes('*')) {
            // wildcard pattern
            const target = resolveCondition(value as PackageExports)
            if (target && target.includes('*')) {
              const expanded = expandWildcard(subpath, target, packagePath, volume)
              entries.push(...expanded)
            }
          } else {
            // regular subpath
            const target = resolveCondition(value as PackageExports)
            if (target) {
              entries.push({
                subpath,
                target,
                isWildcard: false,
              })
            }
          }
        }
      } else {
        // top-level conditions (no subpaths means this is conditions for ".")
        const target = resolveCondition(exportsField)
        if (target) {
          entries.push({
            subpath: '.',
            target,
            isWildcard: false,
          })
        }
      }
    }
  } else {
    // fallback to legacy fields
    // priority: module > main > index.js
    let legacyMain = packageJson.module || packageJson.main

    if (!legacyMain) {
      // check if index.js exists
      try {
        volume.statSync(`${packagePath}/index.js`)
        legacyMain = './index.js'
      } catch {
        // no index.js
      }
    }

    if (legacyMain) {
      entries.push({
        subpath: '.',
        target: legacyMain.startsWith('.') ? legacyMain : `./${legacyMain}`,
        isWildcard: false,
      })
    }
  }

  // determine default subpath
  let defaultSubpath: string | null = null

  // prefer "." if it exists
  const mainEntry = entries.find(e => e.subpath === '.')
  if (mainEntry) {
    defaultSubpath = '.'
  } else if (entries.length > 0) {
    // otherwise, pick first alphabetically
    entries.sort((a, b) => a.subpath.localeCompare(b.subpath))
    defaultSubpath = entries[0]?.subpath ?? null
  }

  return {
    subpaths: entries,
    defaultSubpath,
  }
}

// #endregion
