import type { JsrPackageInfo } from '#shared/types/jsr'

export const packageManagers = [
  { id: 'npm', label: 'npm', action: 'install' },
  { id: 'pnpm', label: 'pnpm', action: 'add' },
  { id: 'yarn', label: 'yarn', action: 'add' },
  { id: 'bun', label: 'bun', action: 'add' },
  { id: 'deno', label: 'deno', action: 'add' },
  { id: 'jsr', label: 'jsr', action: 'add' },
] as const

export type PackageManagerId = (typeof packageManagers)[number]['id']

export interface InstallCommandOptions {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
  jsrInfo?: JsrPackageInfo | null
}

/**
 * Get the package specifier for a given package manager.
 * Handles npm: prefix for deno and jsr (when not native).
 */
export function getPackageSpecifier(options: InstallCommandOptions): string {
  const { packageName, packageManager, jsrInfo } = options

  if (packageManager === 'deno') {
    // deno add npm:package
    return `npm:${packageName}`
  }

  if (packageManager === 'jsr') {
    if (jsrInfo?.exists && jsrInfo.scope && jsrInfo.name) {
      // Native JSR package: @scope/name
      return `@${jsrInfo.scope}/${jsrInfo.name}`
    }
    // npm compatibility: npm:package
    return `npm:${packageName}`
  }

  // Standard package managers (npm, pnpm, yarn, bun)
  return packageName
}

/**
 * Generate the full install command for a package.
 */
export function getInstallCommand(options: InstallCommandOptions): string {
  return getInstallCommandParts(options).join(' ')
}

/**
 * Generate install command as an array of parts.
 * First element is the command (e.g., "npm"), rest are arguments.
 * Useful for rendering with different styling for command vs args.
 */
export function getInstallCommandParts(options: InstallCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  const spec = getPackageSpecifier(options)
  const version = options.version ? `@${options.version}` : ''

  return [pm.label, pm.action, `${spec}${version}`]
}
