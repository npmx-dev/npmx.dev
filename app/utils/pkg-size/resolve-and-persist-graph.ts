import type { NpmPackageMetadata, PackageData } from '~/utils/pkg-size/types'
import { findMaxSatisfying } from 'verkit'
import { db } from '~/utils/pkg-size/db'
import { checkAborted } from '~/utils/pkg-size/check-aborted'

const REGISTRY_URL = 'https://registry.npmjs.org'
const TARGET_OS = 'linux'
const TARGET_CPU = 'x64'
const TARGET_LIBC = 'glibc'

function resolveVersion(metadata: NpmPackageMetadata, rangeOrVersion: string): string | undefined {
  const versions = Object.keys(metadata.versions)
  if (!rangeOrVersion || rangeOrVersion === 'latest' || rangeOrVersion === '*') {
    return metadata['dist-tags'].latest || versions[versions.length - 1]
  }
  if (metadata['dist-tags'][rangeOrVersion]) return metadata['dist-tags'][rangeOrVersion]
  if (metadata.versions[rangeOrVersion]) return rangeOrVersion
  return findMaxSatisfying(versions, rangeOrVersion) || metadata['dist-tags'].latest || undefined
}

function isCompatiblePlatform(pkg: PackageData): boolean {
  let isOsCompatible = true
  if (pkg.os && pkg.os.length > 0) {
    isOsCompatible =
      pkg.os.includes(TARGET_OS) ||
      pkg.os.includes('any') ||
      (!pkg.os.includes(`!${TARGET_OS}`) && !pkg.os.some(o => !o.startsWith('!')))
  }

  let isCpuCompatible = true
  if (pkg.cpu && pkg.cpu.length > 0) {
    isCpuCompatible =
      pkg.cpu.includes(TARGET_CPU) ||
      pkg.cpu.includes('any') ||
      (!pkg.cpu.includes(`!${TARGET_CPU}`) && !pkg.cpu.some(c => !c.startsWith('!')))
  }

  let isLibcCompatible = true
  if (pkg.libc && pkg.libc.length > 0) {
    isLibcCompatible =
      pkg.libc.includes(TARGET_LIBC) ||
      pkg.libc.includes('any') ||
      (!pkg.libc.includes(`!${TARGET_LIBC}`) && !pkg.libc.some(c => !c.startsWith('!')))
  }

  return isOsCompatible && isCpuCompatible && isLibcCompatible
}

async function fetchPackageMetadata(
  packageName: string,
  abortController: AbortController,
): Promise<NpmPackageMetadata> {
  const encodedName = packageName.startsWith('@')
    ? `@${encodeURIComponent(packageName.slice(1))}`
    : encodeURIComponent(packageName)

  const response = await fetch(`${REGISTRY_URL}/${encodedName}`, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
    signal: abortController.signal,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for package ${packageName}: ${response.statusText}`)
  }
  return response.json()
}

async function fetchAndResolve(
  name: string,
  range: string,
  abortController: AbortController,
): Promise<PackageData | undefined> {
  try {
    const metadata = await fetchPackageMetadata(name, abortController)
    const versionKey = resolveVersion(metadata, range)

    if (!versionKey) {
      // oxlint-disable-next-line no-console
      console.warn(`[Warning] Could not resolve version for range "${range}" in package "${name}"`)
      return undefined
    }

    const pkgData = metadata.versions[versionKey]
    if (!pkgData || !isCompatiblePlatform(pkgData)) {
      return undefined
    }

    return pkgData
  } catch (error) {
    if (!abortController.signal.aborted) {
      // oxlint-disable-next-line no-console
      console.error(`[Error] Failed resolving ${name}@${range}:`, error)
    }
    return undefined
  }
}

/**
 * Helper 1: Processes the BFS queue for dependencies and performs batch requests.
 */
async function processBfsQueue(
  packageName: string,
  targetVersion: string,
  abortController: AbortController,
) {
  const memoryGraph = new Map<string, string[]>()
  const packageSizes = new Map<string, number>()
  const visited = new Set<string>()

  const queue: {
    name: string
    range: string
    parentKey?: string
    isOptional: boolean
  }[] = [{ name: packageName, range: targetVersion, isOptional: false }]

  while (queue.length > 0) {
    await checkAborted(abortController)

    const batch = queue.splice(0, 5)

    const results = await Promise.all(
      batch.map(async item => {
        const pkgData = await fetchAndResolve(item.name, item.range, abortController)
        return { item, pkgData }
      }),
    )

    for (const { item, pkgData } of results) {
      if (!pkgData) continue

      const pkgKey = `${pkgData.name}@${pkgData.version}`

      if (!visited.has(pkgKey)) {
        visited.add(pkgKey)
        packageSizes.set(pkgKey, pkgData.dist?.unpackedSize || 0)

        await db.upsertPackage(pkgKey, pkgData)

        for (const [depName, depRange] of Object.entries(pkgData.dependencies || {})) {
          queue.push({ name: depName, range: depRange, parentKey: pkgKey, isOptional: false })
        }
        for (const [depName, depRange] of Object.entries(pkgData.optionalDependencies || {})) {
          queue.push({ name: depName, range: depRange, parentKey: pkgKey, isOptional: true })
        }
      }

      if (item.parentKey) {
        await db.addDependencyEdge(
          item.parentKey,
          pkgData.name,
          pkgKey,
          item.range,
          item.isOptional,
        )

        if (!item.isOptional) {
          if (!memoryGraph.has(item.parentKey)) {
            memoryGraph.set(item.parentKey, [])
          }
          memoryGraph.get(item.parentKey)!.push(pkgKey)
        }
      }
    }
  }

  return { memoryGraph, packageSizes }
}

/**
 * Helper 2: Computes mandatory dependencies via graph traversal.
 */
function computeMandatoryKeys(rootKey: string, memoryGraph: Map<string, string[]>): Set<string> {
  const mandatoryKeys = new Set<string>()
  const traverse = (key: string) => {
    if (mandatoryKeys.has(key)) return
    mandatoryKeys.add(key)
    const normalDeps = memoryGraph.get(key) || []
    normalDeps.forEach(traverse)
  }
  traverse(rootKey)
  return mandatoryKeys
}

export async function resolveAndPersistGraph(
  packageName: string,
  targetVersion: string,
  abortController: AbortController,
): Promise<string> {
  const rootKey = `${packageName}@${targetVersion}`

  const existingSession = await db.getSession(rootKey)
  if (existingSession?.isFinished) {
    return rootKey
  }

  await db.initSession(rootKey)

  // Coordinate via specialized helpers to satisfy linter/CodeRabbit requirements
  const { memoryGraph, packageSizes } = await processBfsQueue(
    packageName,
    targetVersion,
    abortController,
  )

  const mandatoryKeys = computeMandatoryKeys(rootKey, memoryGraph)

  const resolvedPackageKeys: string[] = []
  const optionalPackageKeys: string[] = []
  let totalSize = 0
  let totalOptionalSize = 0

  for (const [key, size] of packageSizes.entries()) {
    if (mandatoryKeys.has(key)) {
      resolvedPackageKeys.push(key)
      totalSize += size
    } else {
      optionalPackageKeys.push(key)
      totalOptionalSize += size
    }
  }

  await db.updateSession(
    rootKey,
    resolvedPackageKeys,
    optionalPackageKeys,
    totalSize,
    totalOptionalSize,
    true,
  )

  return rootKey
}
