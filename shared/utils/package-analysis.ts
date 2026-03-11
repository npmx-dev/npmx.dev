/**
 * Package analysis utilities for detecting module format and TypeScript support
 */

export type ModuleFormat = 'esm' | 'cjs' | 'dual' | 'unknown'

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
  repository?: { url?: string; type?: string; directory?: string }
}

export type PackageExports = string | null | { [key: string]: PackageExports } | PackageExports[]

/**
 * Detect the module format of a package based on package.json fields
 */
export function detectModuleFormat(pkg: ExtendedPackageJson): ModuleFormat {
  const hasExports = pkg.exports != null
  const hasModule = !!pkg.module
  const hasMain = !!pkg.main
  const isTypeModule = pkg.type === 'module'
  const isTypeCommonjs = pkg.type === 'commonjs' || !pkg.type

  // Check exports field for dual format indicators
  if (hasExports && pkg.exports) {
    const exportInfo = analyzeExports(pkg.exports)

    if (exportInfo.hasImport && exportInfo.hasRequire) {
      return 'dual'
    }

    if (exportInfo.hasImport || exportInfo.hasModule) {
      // Has ESM exports, check if also has CJS
      if (hasMain && !isTypeModule) {
        return 'dual'
      }
      return 'esm'
    }

    if (exportInfo.hasRequire) {
      // Has CJS exports, check if also has ESM
      if (hasModule) {
        return 'dual'
      }
      return 'cjs'
    }

    // exports field exists but doesn't use import/require conditions
    // Fall through to other detection methods
  }

  // Legacy detection without exports field
  if (hasModule && hasMain) {
    // Check for dual packages (has module field and main points to cjs)
    const mainIsCJS = pkg.main?.endsWith('.cjs') || (pkg.main?.endsWith('.js') && !isTypeModule)

    return mainIsCJS ? 'dual' : 'esm'
  }

  if (hasModule || isTypeModule) {
    return 'esm'
  }

  if (hasMain || isTypeCommonjs) {
    return 'cjs'
  }

  return 'unknown'
}

interface ExportsAnalysis {
  hasImport: boolean
  hasRequire: boolean
  hasModule: boolean
  hasTypes: boolean
}

/**
 * Recursively analyze exports field for module format indicators
 */
function analyzeExports(exports: PackageExports, depth = 0): ExportsAnalysis {
  const result: ExportsAnalysis = {
    hasImport: false,
    hasRequire: false,
    hasModule: false,
    hasTypes: false,
  }

  // Prevent infinite recursion
  if (depth > 10) return result

  if (exports === null || exports === undefined) {
    return result
  }

  if (typeof exports === 'string') {
    // Check file extension for format hints
    if (exports.endsWith('.mjs') || exports.endsWith('.mts') || exports.endsWith('.json')) {
      result.hasImport = true
    } else if (exports.endsWith('.cjs') || exports.endsWith('.cts')) {
      result.hasRequire = true
    }
    if (exports.endsWith('.d.ts') || exports.endsWith('.d.mts') || exports.endsWith('.d.cts')) {
      result.hasTypes = true
    }
    return result
  }

  if (Array.isArray(exports)) {
    for (const item of exports) {
      const subResult = analyzeExports(item, depth + 1)
      mergeExportsAnalysis(result, subResult)
    }
    return result
  }

  if (typeof exports === 'object') {
    for (const [key, value] of Object.entries(exports)) {
      // Check condition keys
      if (key === 'import') {
        result.hasImport = true
      } else if (key === 'require') {
        result.hasRequire = true
      } else if (key === 'module') {
        result.hasModule = true
      } else if (key === 'types') {
        result.hasTypes = true
      }

      // Recurse into nested exports
      const subResult = analyzeExports(value, depth + 1)
      mergeExportsAnalysis(result, subResult)
    }
  }

  return result
}

function mergeExportsAnalysis(target: ExportsAnalysis, source: ExportsAnalysis): void {
  target.hasImport = target.hasImport || source.hasImport
  target.hasRequire = target.hasRequire || source.hasRequire
  target.hasModule = target.hasModule || source.hasModule
  target.hasTypes = target.hasTypes || source.hasTypes
}

/** Info about a related package (@types or create-*) */
export interface RelatedPackageInfo {
  packageName: string
  deprecated?: string
}

export type TypesPackageInfo = RelatedPackageInfo
export type CreatePackageInfo = RelatedPackageInfo

/**
 * Get the create-* package name for a given package.
 * e.g., "vite" -> "create-vite", "@scope/foo" -> "@scope/create-foo"
 */
export function getCreatePackageName(packageName: string): string {
  if (packageName.startsWith('@')) {
    // Scoped package: @scope/name -> @scope/create-name
    const slashIndex = packageName.indexOf('/')
    const scope = packageName.slice(0, slashIndex)
    const name = packageName.slice(slashIndex + 1)
    return `${scope}/create-${name}`
  }
  return `create-${packageName}`
}

/**
 * Extract the short name from a create-* package for display.
 * e.g., "create-vite" -> "vite", "@scope/create-foo" -> "foo"
 */
export function getCreateShortName(createPackageName: string): string {
  if (createPackageName.startsWith('@')) {
    // @scope/create-foo -> foo
    const slashIndex = createPackageName.indexOf('/')
    const name = createPackageName.slice(slashIndex + 1)
    if (name.startsWith('create-')) {
      return name.slice('create-'.length)
    }
    return name
  }
  // create-vite -> vite
  if (createPackageName.startsWith('create-')) {
    return createPackageName.slice('create-'.length)
  }
  return createPackageName
}

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
  // Check for built-in types
  if (pkg.types || pkg.typings) {
    return { kind: 'included' }
  }

  // Check exports field for types
  if (pkg.exports) {
    const exportInfo = analyzeExports(pkg.exports)
    if (exportInfo.hasTypes) {
      return { kind: 'included' }
    }
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
 * Check if a package has built-in TypeScript types
 * (without needing to check for @types packages)
 */
export function hasBuiltInTypes(pkg: ExtendedPackageJson): boolean {
  // Check types/typings field
  if (pkg.types || pkg.typings) {
    return true
  }

  // Check exports field for types
  if (pkg.exports) {
    const exportInfo = analyzeExports(pkg.exports)
    if (exportInfo.hasTypes) {
      return true
    }
  }

  return false
}

/**
 * Get the @types package name for a given package
 */
export function getTypesPackageName(packageName: string): string {
  if (packageName.startsWith('@')) {
    // Scoped package: @scope/name -> @types/scope__name
    return `@types/${packageName.slice(1).replace('/', '__')}`
  }
  return `@types/${packageName}`
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
