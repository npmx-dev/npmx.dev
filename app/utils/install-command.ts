import type { JsrPackageInfo } from '#shared/types/jsr'
import { getCreateShortName } from '#shared/utils/package-analysis'

// @unocss-include
export const packageManagers = [
  {
    id: 'npm',
    label: 'npm',
    action: 'install',
    executeLocal: 'npx',
    executeRemote: 'npx',
    create: 'npm create',
    icon: 'i-simple-icons:npm',
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    action: 'add',
    executeLocal: 'pnpm exec',
    executeRemote: 'pnpm dlx',
    create: 'pnpm create',
    icon: 'i-simple-icons:pnpm',
  },
  {
    id: 'yarn',
    label: 'yarn',
    action: 'add',
    // For both yarn v1 and v2+ support
    // local exec defers to npx instead
    executeLocal: 'npx',
    executeRemote: 'yarn dlx',
    create: 'yarn create',
    icon: 'i-simple-icons:yarn',
  },
  {
    id: 'bun',
    label: 'bun',
    action: 'add',
    executeLocal: 'bunx',
    executeRemote: 'bunx',
    create: 'bun create',
    icon: 'i-simple-icons:bun',
  },
  {
    id: 'deno',
    label: 'deno',
    action: 'add',
    executeLocal: 'deno run',
    executeRemote: 'deno run',
    create: 'deno create',
    icon: 'i-simple-icons:deno',
  },
  {
    id: 'vlt',
    label: 'vlt',
    action: 'install',
    executeLocal: 'vlx',
    executeRemote: 'vlx',
    create: 'vlx',
    icon: 'i-custom-vlt',
  },
  {
    id: 'vp',
    label: 'vp',
    action: 'add',
    executeLocal: 'vp exec',
    executeRemote: 'vp dlx',
    create: 'vp create',
    icon: 'i-simple-icons:vite',
  },
] as const

export type PackageManagerId = (typeof packageManagers)[number]['id']

export interface InstallCommandOptions {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
  jsrInfo?: JsrPackageInfo | null
  dev?: boolean
}

export function getDevDependencyFlag(packageManager: PackageManagerId): '-D' | '-d' {
  return packageManager === 'bun' ? '-d' : '-D'
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
  const devFlag = options.dev ? [getDevDependencyFlag(options.packageManager)] : []

  return [pm.label, pm.action, ...devFlag, `${spec}${version}`]
}

export interface ExecuteCommandOptions extends InstallCommandOptions {
  /** Whether this is a binary-only package (download & run vs local run) */
  isBinaryOnly?: boolean
  /** Whether this is a create-* package (uses shorthand create command) */
  isCreatePackage?: boolean
}

function getCreatePackageSpecifier(options: ExecuteCommandOptions): string | null {
  if (!options.isCreatePackage) {
    return null
  }

  const shortName = getCreateShortName(options.packageName)
  if (shortName === options.packageName) {
    return null
  }

  if (options.packageManager === 'deno') {
    // npm compatibility: npm:package-name
    return `npm:${shortName}`
  }

  return shortName
}

export function getExecuteCommand(options: ExecuteCommandOptions): string {
  return getExecuteCommandParts(options).join(' ')
}

export function getExecuteCommandParts(options: ExecuteCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  // For create-* packages, use the shorthand create command.
  const createSpecifier = getCreatePackageSpecifier(options)
  if (createSpecifier) {
    return [...pm.create.split(' '), createSpecifier]
  }

  // Choose remote or local execute based on package type
  const executeCmd = options.isBinaryOnly ? pm.executeRemote : pm.executeLocal
  return [...executeCmd.split(' '), getPackageSpecifier(options)]
}
