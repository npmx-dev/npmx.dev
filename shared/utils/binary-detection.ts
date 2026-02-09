/**
 * Metadata needed to determine if a package is binary-only.
 */
export interface PackageMetadata {
  name: string
  bin?: string | Record<string, string>
  main?: string
  module?: unknown
  exports?: unknown
}

/**
 * Determine if a package is "binary-only" (executable without library entry points).
 * Binary-only packages should show execute commands without install commands.
 *
 * A package is binary-only if:
 * - Name starts with "create-" (e.g., create-vite)
 * - Scoped name contains "/create-" (e.g., @vue/create-app)
 * - Has bin field but no main, module, or exports fields
 */
export function isBinaryOnlyPackage(pkg: PackageMetadata): boolean {
  // Check create-* patterns
  if (isCreatePackage(pkg.name)) {
    return true
  }

  // Has bin but no entry points
  const hasBin =
    pkg.bin !== undefined && (typeof pkg.bin === 'string' || Object.keys(pkg.bin).length > 0)
  const hasEntryPoint = !!pkg.main || !!pkg.module || !!pkg.exports

  return hasBin && !hasEntryPoint
}

/**
 * Check if a package uses the create-* naming convention.
 */
export function isCreatePackage(packageName: string): boolean {
  const baseName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName
  return baseName?.startsWith('create-') || packageName.includes('/create-') || false
}
