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
    // Has both module (ESM) and main (CJS) fields
    return 'dual'
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
    if (exports.endsWith('.mjs') || exports.endsWith('.mts')) {
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
 * Detect TypeScript types status for a package
 */
export function detectTypesStatus(
  pkg: ExtendedPackageJson,
  typesPackageInfo?: TypesPackageInfo,
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
}

/**
 * Analyze a package and return structured analysis
 */
export function analyzePackage(
  pkg: ExtendedPackageJson,
  options?: AnalyzePackageOptions,
): PackageAnalysis {
  const moduleFormat = detectModuleFormat(pkg)

  const types = detectTypesStatus(pkg, options?.typesPackage)

  return {
    moduleFormat,
    types,
    engines: pkg.engines,
    createPackage: options?.createPackage,
  }
}
