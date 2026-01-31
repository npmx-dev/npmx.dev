import type { PackageFileTree } from '#shared/types'

/**
 * Flattened file set for quick lookups.
 * Maps file paths to true for existence checks.
 */
export type FileSet = Set<string>

/**
 * Flatten a nested file tree into a set of file paths for quick lookups.
 */
export function flattenFileTree(tree: PackageFileTree[]): FileSet {
  const files = new Set<string>()

  function traverse(nodes: PackageFileTree[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        files.add(node.path)
      } else if (node.children) {
        traverse(node.children)
      }
    }
  }

  traverse(tree)
  return files
}

/**
 * Normalize a path by resolving . and .. segments
 */
function normalizePath(path: string): string {
  const parts = path.split('/')
  const result: string[] = []

  for (const part of parts) {
    if (part === '.' || part === '') {
      continue
    }
    if (part === '..') {
      result.pop()
    } else {
      result.push(part)
    }
  }

  return result.join('/')
}

/**
 * Get the directory of a file path.
 */
function dirname(path: string): string {
  const lastSlash = path.lastIndexOf('/')
  return lastSlash === -1 ? '' : path.substring(0, lastSlash)
}

/**
 * Get file extension priority order based on source file type.
 */
function getExtensionPriority(sourceFile: string): string[][] {
  const ext = sourceFile.split('.').slice(1).join('.')

  // Declaration files prefer other declaration files
  if (ext === 'd.ts' || ext === 'd.mts' || ext === 'd.cts') {
    return [
      [], // exact match first
      ['.d.ts', '.d.mts', '.d.cts'],
      ['.ts', '.mts', '.cts'],
      ['.js', '.mjs', '.cjs'],
      ['.tsx', '.jsx'],
      ['.json'],
    ]
  }

  // TypeScript files
  if (ext === 'ts' || ext === 'tsx') {
    return [[], ['.ts', '.tsx'], ['.d.ts'], ['.js', '.jsx'], ['.json']]
  }

  if (ext === 'mts') {
    return [[], ['.mts'], ['.d.mts', '.d.ts'], ['.mjs', '.js'], ['.json']]
  }

  if (ext === 'cts') {
    return [[], ['.cts'], ['.d.cts', '.d.ts'], ['.cjs', '.js'], ['.json']]
  }

  // JavaScript files
  if (ext === 'js' || ext === 'jsx') {
    return [[], ['.js', '.jsx'], ['.ts', '.tsx'], ['.json']]
  }

  if (ext === 'mjs') {
    return [[], ['.mjs'], ['.js'], ['.mts', '.ts'], ['.json']]
  }

  if (ext === 'cjs') {
    return [[], ['.cjs'], ['.js'], ['.cts', '.ts'], ['.json']]
  }

  // Default for other files (vue, svelte, etc.)
  return [[], ['.ts', '.js'], ['.d.ts'], ['.json']]
}

/**
 * Get index file extensions to try for directory imports.
 */
function getIndexExtensions(sourceFile: string): string[] {
  const ext = sourceFile.split('.').slice(1).join('.')

  if (ext === 'd.ts' || ext === 'd.mts' || ext === 'd.cts') {
    return ['index.d.ts', 'index.d.mts', 'index.d.cts', 'index.ts', 'index.js']
  }

  if (ext === 'mts' || ext === 'mjs') {
    return ['index.mts', 'index.mjs', 'index.ts', 'index.js']
  }

  if (ext === 'cts' || ext === 'cjs') {
    return ['index.cts', 'index.cjs', 'index.ts', 'index.js']
  }

  if (ext === 'ts' || ext === 'tsx') {
    return ['index.ts', 'index.tsx', 'index.js', 'index.jsx']
  }

  return ['index.js', 'index.ts', 'index.mjs', 'index.cjs']
}

export interface ResolvedImport {
  /** The resolved file path (relative to package root) */
  path: string
}

/**
 * Resolve a relative import specifier to an actual file path.
 *
 * @param specifier - The import specifier (e.g., './utils', '../types')
 * @param currentFile - The current file path (e.g., 'dist/index.js')
 * @param files - Set of all file paths in the package
 * @returns The resolved path or null if not found
 */
export function resolveRelativeImport(
  specifier: string,
  currentFile: string,
  files: FileSet,
): ResolvedImport | null {
  // Remove quotes if present
  const cleanSpecifier = specifier.replace(/^['"]|['"]$/g, '').trim()

  // Only handle relative imports
  if (!cleanSpecifier.startsWith('.')) {
    return null
  }

  // Get the directory of the current file
  const currentDir = dirname(currentFile)

  // Resolve the path relative to current directory
  const basePath = currentDir
    ? normalizePath(`${currentDir}/${cleanSpecifier}`)
    : normalizePath(cleanSpecifier)

  // If path is empty or goes above root, return null
  if (!basePath || basePath.startsWith('..')) {
    return null
  }

  // Get extension priority based on source file
  const extensionGroups = getExtensionPriority(currentFile)
  const indexExtensions = getIndexExtensions(currentFile)

  // Try each extension group in priority order
  for (const extensions of extensionGroups) {
    if (extensions.length === 0) {
      // Try exact match
      if (files.has(basePath)) {
        return { path: basePath }
      }
    } else {
      // Try with extensions
      for (const ext of extensions) {
        const pathWithExt = basePath + ext
        if (files.has(pathWithExt)) {
          return { path: pathWithExt }
        }
      }
    }
  }

  // Try as directory with index file
  for (const indexFile of indexExtensions) {
    const indexPath = `${basePath}/${indexFile}`
    if (files.has(indexPath)) {
      return { path: indexPath }
    }
  }

  return null
}

/**
 * Create a resolver function bound to a specific file tree and current file.
 */
export function createImportResolver(
  files: FileSet,
  currentFile: string,
  packageName: string,
  version: string,
): (specifier: string) => string | null {
  return (specifier: string) => {
    const resolved = resolveRelativeImport(specifier, currentFile, files)
    if (resolved) {
      return `/code/${packageName}/v/${version}/${resolved.path}`
    }
    return null
  }
}
