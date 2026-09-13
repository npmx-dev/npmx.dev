import type { PackumentVersion } from '#shared/types/npm-registry'
import type {
  DepFlag,
  DepRegistry,
  DepSectionId,
  PackageDependencyItem,
  PackageDependencySection,
} from '#shared/types/package-dependencies'
import { parsePackageSpec } from '#shared/utils/parse-package-param'

const SECTION_ORDER: DepSectionId[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'bundledDependencies',
]

export function inferDependencyRegistry(name: string, range: string): DepRegistry {
  if (name.startsWith('@jsr/')) return 'jsr'
  if (range.startsWith('jsr:') || range.startsWith('npm:@jsr/')) return 'jsr'
  return 'npm'
}

export interface DependencySpec {
  name: string
  version: string
}

export function normalizeDependencies(
  record: Record<string, string> | undefined,
): Record<string, DependencySpec> {
  if (!record) return {}
  const normalized: Record<string, DependencySpec> = {}
  for (const [key, range] of Object.entries(record)) {
    if (range.startsWith('npm:') || range.startsWith('jsr:')) {
      const { name, version } = parsePackageSpec(range)
      normalized[key] = {
        name,
        version: version ?? '*',
      }
    } else {
      normalized[key] = {
        name: key,
        version: range,
      }
    }
  }
  return normalized
}

export function getNormalizedDependenciesFromPackageVersion(
  reqVer: Partial<PackumentVersion> | null | undefined,
): Record<string, DependencySpec> | undefined {
  if (!reqVer) return undefined
  const rawRecord: Record<string, string> = {
    ...reqVer.dependencies,
    ...reqVer.devDependencies,
    ...reqVer.peerDependencies,
    ...reqVer.optionalDependencies,
  }
  if (Array.isArray(reqVer.bundledDependencies)) {
    for (const name of reqVer.bundledDependencies) {
      if (!rawRecord[name]) {
        rawRecord[name] = reqVer.dependencies?.[name] ?? '*'
      }
    }
  }
  return normalizeDependencies(rawRecord)
}

function entriesToItems(
  record: Record<string, string> | undefined,
  bundledSet: Set<string>,
  extraFlags?: (name: string) => DepFlag[],
): PackageDependencyItem[] {
  if (!record) return []

  return Object.entries(record)
    .map(([name, rawRange]) => {
      const flags: DepFlag[] = [...(extraFlags?.(name) ?? [])]
      if (bundledSet.has(name) && !flags.includes('bundled')) flags.push('bundled')
      let packageName = name
      let range = rawRange

      if (rawRange.startsWith('npm:') || rawRange.startsWith('jsr:')) {
        const parsed = parsePackageSpec(rawRange)
        packageName = parsed.name
        range = parsed.version ?? '*'
      }

      return {
        name,
        packageName,
        range,
        registry: inferDependencyRegistry(name, rawRange),
        flags,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getPackageDependencySections(
  version: Partial<PackumentVersion> | null | undefined,
): PackageDependencySection[] {
  if (!version) return []

  const bundledDeps = Array.isArray(version.bundledDependencies)
    ? version.bundledDependencies
    : typeof version.bundledDependencies === 'boolean' && version.bundledDependencies
      ? Object.keys(version.dependencies ?? {})
      : []
  const bundledSet = new Set(bundledDeps)

  const sections: PackageDependencySection[] = [
    {
      id: 'dependencies',
      items: entriesToItems(version.dependencies, bundledSet),
    },
    {
      id: 'devDependencies',
      items: entriesToItems(version.devDependencies, bundledSet),
    },
    {
      id: 'peerDependencies',
      items: entriesToItems(version.peerDependencies, bundledSet, name => {
        const flags: DepFlag[] = []
        if (version.peerDependenciesMeta?.[name]?.optional) flags.push('optional')
        return flags
      }),
    },
    {
      id: 'optionalDependencies',
      items: entriesToItems(version.optionalDependencies, bundledSet, () => ['optional']),
    },
  ]

  const bundledOnly = bundledDeps
    .filter(name => {
      const inOther =
        name in (version.dependencies ?? {}) ||
        name in (version.devDependencies ?? {}) ||
        name in (version.peerDependencies ?? {}) ||
        name in (version.optionalDependencies ?? {})
      return !inOther
    })
    .map((name): PackageDependencyItem => {
      const rawRange = version.dependencies?.[name] ?? '*'
      let packageName = name
      let range = rawRange

      if (rawRange.startsWith('npm:') || rawRange.startsWith('jsr:')) {
        const parsed = parsePackageSpec(rawRange)
        packageName = parsed.name
        range = parsed.version ?? '*'
      }

      return {
        name,
        packageName,
        range,
        registry: inferDependencyRegistry(name, rawRange),
        flags: ['bundled'],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  if (bundledOnly.length > 0) {
    sections.push({ id: 'bundledDependencies', items: bundledOnly })
  }

  return sections
    .filter(section => section.items.length > 0)
    .sort((a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id))
}

export function hasPackageDependencies(
  version: Partial<PackumentVersion> | null | undefined,
): boolean {
  return getPackageDependencySections(version).length > 0
}

export function getDefaultDependencySection(
  sections: PackageDependencySection[],
): DepSectionId | null {
  return sections[0]?.id ?? null
}

export function isDepSectionId(value: string): value is DepSectionId {
  return SECTION_ORDER.includes(value as DepSectionId)
}
