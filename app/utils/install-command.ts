import type { JsrPackageInfo } from '#shared/types/jsr'

export const packageManagers = [
  {
    id: 'npm',
    label: 'npm',
    action: 'install',
    executeLocal: 'npx',
    executeRemote: 'npx',
    create: 'npm create',
  },
  {
    id: 'pnpm',
    label: 'pnpm',
    action: 'add',
    executeLocal: 'pnpm exec',
    executeRemote: 'pnpm dlx',
    create: 'pnpm create',
  },
  {
    id: 'yarn',
    label: 'yarn',
    action: 'add',
    executeLocal: 'yarn',
    executeRemote: 'yarn dlx',
    create: 'yarn create',
  },
  {
    id: 'bun',
    label: 'bun',
    action: 'add',
    executeLocal: 'bunx',
    executeRemote: 'bunx',
    create: 'bun create',
  },
  {
    id: 'deno',
    label: 'deno',
    action: 'add',
    executeLocal: 'deno run',
    executeRemote: 'deno run',
    create: 'deno run',
  },
  {
    id: 'vlt',
    label: 'vlt',
    action: 'install',
    executeLocal: 'vlt x',
    executeRemote: 'vlt x',
    create: 'vlt x',
  },
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

export interface ExecuteCommandOptions extends InstallCommandOptions {
  /** Whether this is a binary-only package (download & run vs local run) */
  isBinaryOnly?: boolean
  /** Whether this is a create-* package (uses shorthand create command) */
  isCreatePackage?: boolean
}

export function getExecuteCommand(options: ExecuteCommandOptions): string {
  return getExecuteCommandParts(options).join(' ')
}

export function getExecuteCommandParts(options: ExecuteCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  // For create-* packages, use the shorthand create command
  if (options.isCreatePackage) {
    const createName = extractCreateName(options.packageName)
    if (createName) {
      return [...pm.create.split(' '), createName]
    }
  }

  // Choose remote or local execute based on package type
  const executeCmd = options.isBinaryOnly ? pm.executeRemote : pm.executeLocal
  return [...executeCmd.split(' '), getPackageSpecifier(options)]
}

/**
 * Extract the short name from a create-* package.
 * e.g., "create-vite" -> "vite", "@vue/create-app" -> "vue"
 */
function extractCreateName(packageName: string): string | null {
  // Handle scoped packages: @scope/create-foo -> foo
  if (packageName.startsWith('@')) {
    const parts = packageName.split('/')
    const baseName = parts[1]
    if (baseName?.startsWith('create-')) {
      return baseName.slice('create-'.length)
    }
    // Handle @vue/create-app style (scope as the name)
    if (baseName?.startsWith('create')) {
      return parts[0]!.slice(1) // Remove @ from scope
    }
  }

  // Handle unscoped: create-foo -> foo
  if (packageName.startsWith('create-')) {
    return packageName.slice('create-'.length)
  }

  return null
}
