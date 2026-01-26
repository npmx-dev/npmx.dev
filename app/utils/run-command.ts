import type { JsrPackageInfo } from '#shared/types/jsr'
import { getPackageSpecifier, packageManagers } from './install-command'
import type { PackageManagerId } from './install-command'

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
  if (commands.length === 0) {
    return { primaryCommand: '', commands: [], hasExecutable: false }
  }

  // Prefer command matching package name if it exists, otherwise use first
  const baseName = packageName.startsWith('@') ? packageName.split('/')[1] : packageName
  const primaryCommand = commands.includes(baseName) ? baseName : commands[0]

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
}

/**
 * Generate run command as an array of parts.
 * For example: ["npx", "eslint"] or ["bunx", "tsc"]
 */
export function getRunCommandParts(options: RunCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  const spec = getPackageSpecifier(options)

  // For deno, always use the package specifier
  if (options.packageManager === 'deno') {
    return [pm.execute, spec]
  }

  // For npx/bunx/pnpm dlx/yarn dlx/vlt x, the command name is what gets executed
  // e.g., `npx tsc` runs the tsc command from typescript package
  // If the command matches the package name (like eslint), use the package spec
  // Otherwise, use the command name directly (like tsc for typescript)
  if (options.command && options.command !== options.packageName) {
    const baseName = options.packageName.startsWith('@')
      ? options.packageName.split('/')[1]
      : options.packageName
    // If command matches base package name, use the package spec
    if (options.command === baseName) {
      return [pm.execute, spec]
    }
    // Otherwise use the command name directly (e.g., npx tsc, not npx typescript/tsc)
    return [pm.execute, options.command]
  }

  return [pm.execute, spec]
}

/**
 * Generate the full run command for a package.
 */
export function getRunCommand(options: RunCommandOptions): string {
  return getRunCommandParts(options).join(' ')
}
