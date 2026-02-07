import { diff as semverDiff } from 'semver'
import type { PackageFileTree, DependencyChange, FileChange, CompareResponse } from '#shared/types'

/** Maximum number of files to include in comparison */
const MAX_FILES_COMPARE = 1000

function traverse(nodes: PackageFileTree[], result: Map<string, PackageFileTree>) {
  for (const node of nodes) {
    result.set(node.path, node)
    if (node.children) {
      traverse(node.children, result)
    }
  }
}

/** Flatten a file tree into a map of path -> node */
export function flattenTree(tree: PackageFileTree[]): Map<string, PackageFileTree> {
  const result = new Map<string, PackageFileTree>()

  traverse(tree, result)
  return result
}

const hasChanged = (fromNode: PackageFileTree, toNode: PackageFileTree): boolean => {
  // Prefer strong hash comparison when both hashes are available
  if (fromNode.hash && toNode.hash) return fromNode.hash !== toNode.hash
  // Fallback to size comparison if hashes are missing
  if (typeof fromNode.size === 'number' && typeof toNode.size === 'number') {
    return fromNode.size !== toNode.size
  }
  // If we lack comparable signals, assume unchanged
  return false
}

/** Compare two file trees and return changes */
export function compareFileTrees(
  fromTree: PackageFileTree[],
  toTree: PackageFileTree[],
): { added: FileChange[]; removed: FileChange[]; modified: FileChange[]; truncated: boolean } {
  const fromFiles = flattenTree(fromTree)
  const toFiles = flattenTree(toTree)

  const added: FileChange[] = []
  const removed: FileChange[] = []
  const modified: FileChange[] = []
  let truncated = false
  const overLimit = () => added.length + removed.length + modified.length >= MAX_FILES_COMPARE

  // Find added and modified files
  for (const [path, toNode] of toFiles) {
    if (overLimit()) {
      truncated = true
      break
    }

    const fromNode = fromFiles.get(path)

    // Handle directory -> file / file -> directory transitions
    if (toNode.type === 'directory') {
      if (fromNode?.type === 'file') {
        removed.push({
          path,
          type: 'removed',
          oldSize: fromNode.size,
        })
      }
      continue
    }

    // toNode is file
    if (!fromNode) {
      // New file
      added.push({
        path,
        type: 'added',
        newSize: toNode.size,
      })
    } else if (fromNode.type === 'directory') {
      // Path was a directory, now a file -> treat as added file
      added.push({
        path,
        type: 'added',
        newSize: toNode.size,
      })
    } else if (fromNode.type === 'file') {
      if (hasChanged(fromNode, toNode)) {
        modified.push({
          path,
          type: 'modified',
          oldSize: fromNode.size,
          newSize: toNode.size,
        })
      }
    }
  }

  // Find removed files
  for (const [path, fromNode] of fromFiles) {
    if (fromNode.type === 'directory') continue

    if (overLimit()) {
      truncated = true
      break
    }

    if (!toFiles.has(path)) {
      removed.push({
        path,
        type: 'removed',
        oldSize: fromNode.size,
      })
    }
  }

  // Sort by path
  added.sort((a, b) => a.path.localeCompare(b.path))
  removed.sort((a, b) => a.path.localeCompare(b.path))
  modified.sort((a, b) => a.path.localeCompare(b.path))

  return { added, removed, modified, truncated }
}

/** Compare dependencies between two package.json files */
export function compareDependencies(
  fromPkg: Record<string, unknown> | null,
  toPkg: Record<string, unknown> | null,
): DependencyChange[] {
  const changes: DependencyChange[] = []
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const

  for (const section of sections) {
    const fromDeps = (fromPkg?.[section] as Record<string, string>) ?? {}
    const toDeps = (toPkg?.[section] as Record<string, string>) ?? {}

    const allNames = new Set([...Object.keys(fromDeps), ...Object.keys(toDeps)])

    for (const name of allNames) {
      const fromVersion = fromDeps[name] ?? null
      const toVersion = toDeps[name] ?? null

      if (fromVersion === toVersion) continue

      let type: 'added' | 'removed' | 'updated'
      if (!fromVersion) type = 'added'
      else if (!toVersion) type = 'removed'
      else type = 'updated'

      let semverDiffType: DependencyChange['semverDiff'] = null
      if (type === 'updated' && fromVersion && toVersion) {
        // Try to compute semver diff
        try {
          // Strip ^ ~ >= etc for comparison
          const cleanFrom = fromVersion.replace(/^[\^~>=<]+/, '')
          const cleanTo = toVersion.replace(/^[\^~>=<]+/, '')
          const diffResult = semverDiff(cleanFrom, cleanTo)
          if (diffResult) {
            if (
              diffResult === 'premajor' ||
              diffResult === 'preminor' ||
              diffResult === 'prepatch'
            ) {
              semverDiffType = 'prerelease'
            } else if (['major', 'minor', 'patch', 'prerelease'].includes(diffResult)) {
              semverDiffType = diffResult as 'major' | 'minor' | 'patch' | 'prerelease'
            }
          }
        } catch {
          // Invalid semver, ignore
        }
      }

      changes.push({
        name,
        section,
        from: fromVersion,
        to: toVersion,
        type,
        semverDiff: semverDiffType,
      })
    }
  }

  // Sort: by section, then by name
  changes.sort((a, b) => {
    if (a.section !== b.section) {
      return sections.indexOf(a.section) - sections.indexOf(b.section)
    }
    return a.name.localeCompare(b.name)
  })

  return changes
}

/** Count total files in a tree */
export function countFiles(tree: PackageFileTree[]): number {
  let count = 0

  function traverse(nodes: PackageFileTree[]) {
    for (const node of nodes) {
      if (node.type === 'file') count++
      if (node.children) traverse(node.children)
    }
  }

  traverse(tree)
  return count
}

/** Build the full compare response */
export function buildCompareResponse(
  packageName: string,
  from: string,
  to: string,
  fromTree: PackageFileTree[],
  toTree: PackageFileTree[],
  fromPkg: Record<string, unknown> | null,
  toPkg: Record<string, unknown> | null,
  computeTime: number,
): CompareResponse {
  const fileChanges = compareFileTrees(fromTree, toTree)
  const dependencyChanges = compareDependencies(fromPkg, toPkg)

  const warnings: string[] = []
  if (fileChanges.truncated) {
    warnings.push(`File list truncated to ${MAX_FILES_COMPARE} files`)
  }

  return {
    package: packageName,
    from,
    to,
    packageJson: {
      from: fromPkg,
      to: toPkg,
    },
    files: {
      added: fileChanges.added,
      removed: fileChanges.removed,
      modified: fileChanges.modified,
    },
    dependencyChanges,
    stats: {
      totalFilesFrom: countFiles(fromTree),
      totalFilesTo: countFiles(toTree),
      filesAdded: fileChanges.added.length,
      filesRemoved: fileChanges.removed.length,
      filesModified: fileChanges.modified.length,
    },
    meta: {
      truncated: fileChanges.truncated,
      warnings: warnings.length > 0 ? warnings : undefined,
      computeTime,
    },
  }
}
