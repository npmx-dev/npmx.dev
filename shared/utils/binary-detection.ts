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
 * Check if a package uses the create-* naming convention.
 */
export function isCreatePackage(packageName: string): boolean {
  const baseName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName
  return baseName?.startsWith('create-') || packageName.includes('/create-') || false
}
