import { parsePackageSpec } from '#shared/utils/parse-package-param'

export type DependencyCategory =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'

export interface PackageJsonDependency {
  name: string
  /** Version range from package.json */
  range: string
  packageName: string
  category: DependencyCategory
  /** True when the range is not a registry package (file:, workspace:, git, etc.) */
  nonRegistry: boolean
}

export interface ParsedPackageJson {
  name?: string
  version?: string
  dependencies: PackageJsonDependency[]
}

const DEPENDENCY_CATEGORIES: DependencyCategory[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

const NON_REGISTRY_PREFIXES = [
  'file:',
  'link:',
  'workspace:',
  'portal:',
  'git+',
  'git:',
  'github:',
  'gist:',
  'bitbucket:',
  'gitlab:',
  'jsr:',
  'http:',
  'https:',
]

export function isNonRegistryRange(range: string): boolean {
  const trimmed = range.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('.') || trimmed.startsWith('/')) return true
  return NON_REGISTRY_PREFIXES.some(prefix => trimmed.toLowerCase().startsWith(prefix))
}

/**
 * Resolve `npm:pkg@range` / `npm:@scope/pkg@range` aliases to a registry package name.
 * Returns `null` when the alias cannot be parsed.
 */
export function resolveNpmAlias(range: string): { packageName: string; range: string } | null {
  if (!range.startsWith('npm:')) return null

  const spec = range.slice('npm:'.length)
  if (!spec) return null

  const { name, version } = parsePackageSpec(spec)
  return {
    packageName: name,
    range: version || '*',
  }
}

function toDependency(
  name: string,
  range: string,
  category: DependencyCategory,
): PackageJsonDependency {
  const alias = resolveNpmAlias(range)
  if (alias) {
    return {
      name,
      range: alias.range,
      packageName: alias.packageName,
      category,
      nonRegistry: isNonRegistryRange(alias.range),
    }
  }

  return {
    name,
    range,
    packageName: name,
    category,
    nonRegistry: isNonRegistryRange(range),
  }
}

export function parsePackageJsonDependencies(raw: unknown): ParsedPackageJson {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid package.json: expected a JSON object')
  }

  const pkg = raw as Record<string, unknown>
  const dependencies: PackageJsonDependency[] = []

  for (const category of DEPENDENCY_CATEGORIES) {
    const section = pkg[category]
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue

    for (const [name, range] of Object.entries(section as Record<string, unknown>)) {
      if (typeof range !== 'string') continue
      dependencies.push(toDependency(name, range, category))
    }
  }

  dependencies.sort((a, b) => {
    const categoryOrder =
      DEPENDENCY_CATEGORIES.indexOf(a.category) - DEPENDENCY_CATEGORIES.indexOf(b.category)
    if (categoryOrder !== 0) return categoryOrder
    return a.name.localeCompare(b.name)
  })

  return {
    name: typeof pkg.name === 'string' ? pkg.name : undefined,
    version: typeof pkg.version === 'string' ? pkg.version : undefined,
    dependencies,
  }
}

export function parsePackageJsonText(text: string): ParsedPackageJson {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Invalid package.json: could not parse JSON')
  }
  return parsePackageJsonDependencies(parsed)
}
