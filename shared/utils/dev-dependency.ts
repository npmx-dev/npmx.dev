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

const KNOWN_DEV_DEPENDENCY_PACKAGE_PREFIXES = [
  '@typescript-eslint/',
  'eslint-',
  'prettier-',
  'vite-',
  'webpack-',
  'babel-',
]

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
    KNOWN_DEV_DEPENDENCY_PACKAGE_PREFIXES.some(prefix =>
      prefix.startsWith('@') ? normalized.startsWith(prefix) : namePart.startsWith(prefix),
    )
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasReadmeDevInstallHint(packageName: string, readmeContent?: string | null): boolean {
  if (!readmeContent) return false

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
    new RegExp(String.raw`deno\s+add\s+(?:--dev|-D)\s+${packageSpec}`, 'i'),
  ]

  return patterns.some(pattern => pattern.test(readmeContent))
}

export function getDevDependencySuggestion(
  packageName: string,
  readmeContent?: string | null,
): DevDependencySuggestion {
  if (isKnownDevDependencyPackage(packageName)) {
    return {
      recommended: true,
      reason: 'known-package',
    }
  }

  if (hasReadmeDevInstallHint(packageName, readmeContent)) {
    return {
      recommended: true,
      reason: 'readme-hint',
    }
  }

  return { recommended: false }
}
