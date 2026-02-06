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
    create: 'deno run',
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
] as const

export type PackageManagerId = (typeof packageManagers)[number]['id']

export interface InstallCommandOptions {
  packageName: string
  packageManager: PackageManagerId
  version?: string | null
  jsrInfo?: JsrPackageInfo | null
  dev?: boolean
}

export type DevDependencySuggestionReason = 'known-package' | 'readme-hint'

export interface DevDependencySuggestion {
  recommended: boolean
  reason?: DevDependencySuggestionReason
}

const KNOWN_DEV_DEPENDENCY_PACKAGES = new Set<string>([
  'biome',
  'chai',
  'eslint',
  'esbuild',
  'husky',
  'jest',
  'lint-staged',
  'mocha',
  'oxc',
  'oxfmt',
  'oxlint',
  'playwright',
  'prettier',
  'rolldown',
  'rollup',
  'stylelint',
  'ts-jest',
  'ts-node',
  'tsx',
  'turbo',
  'typescript',
  'vite',
  'vitest',
  'webpack',
])

function isKnownDevDependencyPackage(packageName: string): boolean {
  const normalized = packageName.toLowerCase()
  if (normalized.startsWith('@types/')) {
    return true
  }
  // Match scoped packages by name segment, e.g. @scope/eslint-config
  const namePart = normalized.includes('/') ? normalized.split('/').pop() : normalized
  if (!namePart) return false

  return (
    KNOWN_DEV_DEPENDENCY_PACKAGES.has(normalized) ||
    KNOWN_DEV_DEPENDENCY_PACKAGES.has(namePart) ||
    normalized.startsWith('@typescript-eslint/') ||
    namePart.startsWith('eslint-') ||
    namePart.startsWith('prettier-') ||
    namePart.startsWith('vite-') ||
    namePart.startsWith('webpack-') ||
    namePart.startsWith('babel-')
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasReadmeDevInstallHint(packageName: string, readmeHtml?: string | null): boolean {
  if (!readmeHtml) return false

  const escapedName = escapeRegExp(packageName)
  const escapedNpmName = escapeRegExp(`npm:${packageName}`)
  const packageSpec = `(?:${escapedName}|${escapedNpmName})(?:@[\\w.-]+)?`

  const patterns = [
    // npm install -D pkg / pnpm add --save-dev pkg
    new RegExp(
      String.raw`(?:npm|pnpm|yarn|bun|vlt)\s+(?:install|add|i)\s+(?:--save-dev|--dev|-d)\s+${packageSpec}`,
      'i',
    ),
    // npm install pkg --save-dev / pnpm add pkg -D
    new RegExp(
      String.raw`(?:npm|pnpm|yarn|bun|vlt)\s+(?:install|add|i)\s+${packageSpec}\s+(?:--save-dev|--dev|-d)`,
      'i',
    ),
    // deno add -D npm:pkg
    new RegExp(String.raw`deno\s+add\s+(?:--dev|-d)\s+${packageSpec}`, 'i'),
  ]

  return patterns.some(pattern => pattern.test(readmeHtml))
}

export function getDevDependencySuggestion(
  packageName: string,
  readmeHtml?: string | null,
): DevDependencySuggestion {
  if (isKnownDevDependencyPackage(packageName)) {
    return {
      recommended: true,
      reason: 'known-package',
    }
  }

  if (hasReadmeDevInstallHint(packageName, readmeHtml)) {
    return {
      recommended: true,
      reason: 'readme-hint',
    }
  }

  return { recommended: false }
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

export function getExecuteCommand(options: ExecuteCommandOptions): string {
  return getExecuteCommandParts(options).join(' ')
}

export function getExecuteCommandParts(options: ExecuteCommandOptions): string[] {
  const pm = packageManagers.find(p => p.id === options.packageManager)
  if (!pm) return []

  // For create-* packages, use the shorthand create command
  if (options.isCreatePackage) {
    const shortName = getCreateShortName(options.packageName)
    if (shortName !== options.packageName) {
      return [...pm.create.split(' '), shortName]
    }
  }

  // Choose remote or local execute based on package type
  const executeCmd = options.isBinaryOnly ? pm.executeRemote : pm.executeLocal
  return [...executeCmd.split(' '), getPackageSpecifier(options)]
}
