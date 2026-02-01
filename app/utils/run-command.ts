import type { JsrPackageInfo } from '#shared/types/jsr'
import { getPackageSpecifier, packageManagers } from './install-command'
import type { PackageManagerId } from './install-command'

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

/**
 * Information about executable commands provided by a package.
 */
export interface ExecutableInfo {
  /** Primary command name (typically the package name or first bin key) */
  primaryCommand: string
  /** All available command names */
  commands: string[]
  /** Whether this package has any executables */
  hasExecutable: boolean
}

/**
 * Extract executable command information from a package's bin field.
 * Handles both string format ("bin": "./cli.js") and object format ("bin": { "cmd": "./cli.js" }).
 */
export function getExecutableInfo(
  packageName: string,
  bin: string | Record<string, string> | undefined,
): ExecutableInfo {
  if (!bin) {
    return { primaryCommand: '', commands: [], hasExecutable: false }
  }

  // String format: package name becomes the command
  if (typeof bin === 'string') {
    return {
      primaryCommand: packageName,
      commands: [packageName],
      hasExecutable: true,
    }
  }

  // Object format: keys are command names
  const commands = Object.keys(bin)
  const firstCommand = commands[0]
  if (!firstCommand) {
    return { primaryCommand: '', commands: [], hasExecutable: false }
  }

  // Prefer command matching package name if it exists, otherwise use first
  const baseName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName
  const primaryCommand = baseName && commands.includes(baseName) ? baseName : firstCommand

  return {
    primaryCommand,
    commands,
    hasExecutable: true,
  }
}

export interface RunCommandOptions {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
  jsrInfo?: JsrPackageInfo | null
  /** Specific command to run (for packages with multiple bin entries) */
  command?: string
  /** Whether this is a binary-only package (affects which execute command to use) */
  isBinaryOnly?: boolean
}

/**
 * Generate run command as an array of parts.
 * First element is the package manager label (e.g., "pnpm"), rest are arguments.
 * For example: ["pnpm", "exec", "eslint"] or ["pnpm", "dlx", "create-vite"]
 */
export function getRunCommandParts(options: RunCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  const spec = getPackageSpecifier(options)

  // Choose execute command based on package type
  const executeCmd = options.isBinaryOnly ? pm.executeRemote : pm.executeLocal
  const executeParts = executeCmd.split(' ')

  // For deno, always use the package specifier
  if (options.packageManager === 'deno') {
    return [...executeParts, spec]
  }

  // For local execute with specific command name different from package name
  // e.g., `pnpm exec tsc` for typescript package
  if (options.command && options.command !== options.packageName) {
    const baseName = options.packageName.startsWith('@')
      ? options.packageName.split('/')[1]
      : options.packageName
    // If command matches base package name, use the package spec
    if (options.command === baseName) {
      return [...executeParts, spec]
    }
    // Otherwise use the command name directly
    return [...executeParts, options.command]
  }

  return [...executeParts, spec]
}

/**
 * Generate the full run command for a package.
 */
export function getRunCommand(options: RunCommandOptions): string {
  return getRunCommandParts(options).join(' ')
}
