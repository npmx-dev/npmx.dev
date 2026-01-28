import type { JsrPackageInfo } from '#shared/types/jsr'

// @unocss-include
export const packageManagers = [
  {
    id: 'npm',
    label: 'npm',
    action: 'install',
    execute: 'npx',
    icon: 'i-vscode-icons:file-type-npm',
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    action: 'add',
    execute: 'pnpm dlx',
    icon: 'i-vscode-icons:file-type-light-pnpm',
  },
  {
    id: 'yarn',
    label: 'yarn',
    action: 'add',
    execute: 'yarn dlx',
    icon: 'i-vscode-icons:file-type-yarn',
  },
  { id: 'bun', label: 'bun', action: 'add', execute: 'bunx', icon: 'i-vscode-icons:file-type-bun' },
  {
    id: 'deno',
    label: 'deno',
    action: 'add',
    execute: 'deno run',
    icon: 'i-vscode-icons:file-type-light-deno',
  },
  { id: 'vlt', label: 'vlt', action: 'install', execute: 'vlt x', icon: 'i-custom-vlt' },
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
 * Handles jsr: prefix for deno (when available on JSR).
 */
export function getPackageSpecifier(options: InstallCommandOptions): string {
  const { packageName, packageManager, jsrInfo } = options

  if (packageManager === 'deno') {
    if (jsrInfo?.exists && jsrInfo.scope && jsrInfo.name) {
      // Native JSR package: jsr:@scope/name
      return `jsr:@${jsrInfo.scope}/${jsrInfo.name}`
    }
    // npm compatibility: npm:package
    return `npm:${packageName}`
  }

  // Standard package managers (npm, pnpm, yarn, bun, vlt)
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

export function getExecuteCommand(options: InstallCommandOptions): string {
  return getExecuteCommandParts(options).join(' ')
}

export function getExecuteCommandParts(options: InstallCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []
  return [pm.execute, getPackageSpecifier(options)]
}
