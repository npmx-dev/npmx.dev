import type { ModuleFormat } from 'npmeta'
import { detectModuleFormat, hasBuiltInTypes } from 'npmeta'

export type TypesStatus =
  | { kind: 'included' }
  | { kind: '@types'; packageName: string; deprecated?: string }
  | { kind: 'none' }

export interface PackageAnalysis {
  moduleFormat: ModuleFormat
  types: TypesStatus
  engines?: Record<string, string>
  /** Associated create-* package if it exists */
  createPackage?: CreatePackageInfo
}

/**
 * Extended package.json fields not in @npm/types
 * These are commonly used but not included in the official types
 */
export interface ExtendedPackageJson {
  name?: string
  version?: string
  type?: 'module' | 'commonjs'
  main?: string
  module?: string
  types?: string
  typings?: string
  exports?: PackageExports
  engines?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  /** npm maintainers (returned by registry API) */
  maintainers?: Array<{ name: string; email?: string }>
  /** Repository info (returned by registry API) */
  repository?: { url?: string; type?: string; directory?: string } | string
}

type PackageExports = string | null | { [key: string]: PackageExports } | PackageExports[]

/** Info about a related package (@types or create-*) */
interface RelatedPackageInfo {
  packageName: string
  deprecated?: string
}

export type TypesPackageInfo = RelatedPackageInfo
export type CreatePackageInfo = RelatedPackageInfo

/**
 * Map of JS extensions to their corresponding declaration file extensions.
 */
const DECLARATION_EXTENSIONS: Record<string, string[]> = {
  '.mjs': ['.d.mts', '.d.ts'],
  '.cjs': ['.d.cts', '.d.ts'],
  '.js': ['.d.ts', '.d.mts', '.d.cts'],
}

/**
 * Collect concrete file paths from the exports field, skipping the "types"
 * condition (which is already checked by analyzeExports).
 */
function collectExportPaths(exports: PackageExports, depth = 0): string[] {
  if (depth > 10) return []
  if (exports === null || exports === undefined) return []

  if (typeof exports === 'string') {
    return [exports]
  }

  if (Array.isArray(exports)) {
    return exports.flatMap(item => collectExportPaths(item, depth + 1))
  }

  if (typeof exports === 'object') {
    const paths: string[] = []
    for (const [key, value] of Object.entries(exports)) {
      // Skip "types" condition — already detected by analyzeExports
      if (key === 'types') continue
      paths.push(...collectExportPaths(value, depth + 1))
    }
    return paths
  }

  return []
}

/**
 * Normalize a path by stripping a leading "./" prefix.
 */
function stripRelativePrefix(p: string): string {
  return p.startsWith('./') ? p.slice(2) : p
}

/**
 * Derive expected declaration file paths from a JS entry point path.
 * e.g. "./dist/index.mjs" -> ["dist/index.d.mts", "dist/index.d.ts"]
 */
function getDeclCandidates(entryPath: string): string[] {
  const normalized = stripRelativePrefix(entryPath)
  for (const [ext, declExts] of Object.entries(DECLARATION_EXTENSIONS)) {
    if (normalized.endsWith(ext)) {
      const base = normalized.slice(0, -ext.length)
      return declExts.map(de => base + de)
    }
  }
  return []
}

/**
 * Check if declaration files exist for any of the package's entry points.
 * Derives expected declaration paths from exports/main/module entry points
 * (e.g. .d.mts for .mjs) and checks if they exist in the published files.
 */
function hasImplicitTypesForEntryPoints(pkg: ExtendedPackageJson, files: Set<string>): boolean {
  const entryPaths: string[] = []

  if (pkg.exports) {
    entryPaths.push(...collectExportPaths(pkg.exports))
  }
  if (pkg.main) {
    entryPaths.push(pkg.main)
  }
  if (pkg.module) {
    entryPaths.push(pkg.module)
  }

  for (const entryPath of entryPaths) {
    const candidates = getDeclCandidates(entryPath)
    if (candidates.some(c => files.has(c))) {
      return true
    }
  }

  return false
}

/**
 * Detect TypeScript types status for a package
 */
export function detectTypesStatus(
  pkg: ExtendedPackageJson,
  typesPackageInfo?: TypesPackageInfo,
  files?: Set<string>,
): TypesStatus {
  if (hasBuiltInTypes(pkg)) {
    return { kind: 'included' }
  }

  // Check for implicit types by deriving expected declaration file paths from
  // entry points (e.g. .d.mts for .mjs) and checking if they exist in the package
  if (files && hasImplicitTypesForEntryPoints(pkg, files)) {
    return { kind: 'included' }
  }

  // Check for @types package
  if (typesPackageInfo) {
    return {
      kind: '@types',
      packageName: typesPackageInfo.packageName,
      deprecated: typesPackageInfo.deprecated,
    }
  }

  return { kind: 'none' }
}

/**
 * Options for package analysis
 */
export interface AnalyzePackageOptions {
  typesPackage?: TypesPackageInfo
  createPackage?: CreatePackageInfo
  /** Flattened package file paths for implicit types detection (e.g. .d.mts next to .mjs) */
  files?: Set<string>
}

/**
 * Analyze a package and return structured analysis
 */
export function analyzePackage(
  pkg: ExtendedPackageJson,
  options?: AnalyzePackageOptions,
): PackageAnalysis {
  const moduleFormat = detectModuleFormat(pkg)
  const types = detectTypesStatus(pkg, options?.typesPackage, options?.files)

  return {
    moduleFormat,
    types,
    engines: pkg.engines,
    createPackage: options?.createPackage,
  }
}
