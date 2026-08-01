import type {
  AnalysisSessionEntity,
  AnalyzeCauseWorkerRequest,
  AnalyzeWorkerResponse,
  DiffResult,
  PackageEntity,
} from '~/utils/pkg-size/types'
import { AbortedError, checkAborted } from '~/utils/pkg-size/check-aborted'
import { db } from '~/utils/pkg-size/db'
import { resolveAndPersistGraph } from '~/utils/pkg-size/resolve-and-persist-graph'

let abortController: AbortController | undefined
let inFlightId: number | string | undefined

function post(msg: AnalyzeWorkerResponse) {
  ;(self as unknown as Worker).postMessage(msg)
}

self.addEventListener('message', async (event: MessageEvent<AnalyzeCauseWorkerRequest>) => {
  const msg = event.data
  const { id, type } = msg

  if (type === 'analyze-cause-abort') {
    if (abortController && inFlightId === id) {
      abortController.abort()
      post({ type: 'aborting', id })
    } else {
      post({ type: 'aborted', id })
    }
    return
  }

  if (type !== 'analyze-cause') {
    return
  }

  const { packageName, fromVersion, toVersion, ignoreOptional = false } = msg

  abortController?.abort()
  const controller = new AbortController()
  abortController = controller
  inFlightId = id

  const keys = {
    fromVersion: `${packageName}@${fromVersion}`,
    toVersion: `${packageName}@${toVersion}`,
  }

  try {
    const existing = (await db.getSessions([keys.fromVersion, keys.toVersion])) || []
    const existingKeys = new Set(existing.map(s => s.rootKey))

    const keysToInit: string[] = []
    if (!existingKeys.has(keys.fromVersion)) {
      keysToInit.push(keys.fromVersion)
    }
    if (!existingKeys.has(keys.toVersion)) {
      keysToInit.push(keys.toVersion)
    }

    if (keysToInit.length > 0) {
      await db.initSession(keysToInit)
    }

    post({ type: 'sessions', id, fromVersion, toVersion })

    await Promise.all([
      resolveAndPersistGraph(packageName, fromVersion, controller),
      resolveAndPersistGraph(packageName, toVersion, controller),
    ])

    await checkAborted(controller)

    const [session1, session2] = await Promise.all([
      db.getSession(keys.fromVersion),
      db.getSession(keys.toVersion),
    ])

    function getKeysForSession(session?: AnalysisSessionEntity) {
      if (!session) {
        return []
      }
      return ignoreOptional
        ? [...session.resolvedPackageKeys]
        : [...session.resolvedPackageKeys, ...(session.optionalPackageKeys || [])]
    }

    const keysV1 = getKeysForSession(session1)
    const keysV2 = getKeysForSession(session2)

    const packagesV1 =
      keysV1.length > 0 ? await db.packages.where('id').anyOf(keysV1).toArray() : []
    const packagesV2 =
      keysV2.length > 0 ? await db.packages.where('id').anyOf(keysV2).toArray() : []

    const optionalKeysV1 = new Set(session1?.optionalPackageKeys || [])
    const optionalKeysV2 = new Set(session2?.optionalPackageKeys || [])

    const mapV1 = buildFlatMap(packagesV1, optionalKeysV1)
    const mapV2 = buildFlatMap(packagesV2, optionalKeysV2)

    const result: DiffResult[] = []
    const allPackageNames = new Set([...mapV1.keys(), ...mapV2.keys()])

    for (const name of allPackageNames) {
      const p1 = mapV1.get(name)
      const p2 = mapV2.get(name)

      if (!p1 && p2) {
        result.push({
          name,
          status: 'added',
          v1: null,
          v2: p2,
          sizeDelta: p2.size,
          isOptional: p2.isOptional,
        })
      } else if (p1 && !p2) {
        result.push({
          name,
          status: 'removed',
          v1: p1,
          v2: null,
          sizeDelta: -p1.size,
          isOptional: p1.isOptional,
        })
      }
      // Version jumps (changed) and no-change entries are ignored
    }

    result.sort((a, b) => Math.abs(b.sizeDelta) - Math.abs(a.sizeDelta))

    const sizeV1 = session1
      ? session1.totalSize + (ignoreOptional ? 0 : session1.totalOptionalSize || 0)
      : 0
    const sizeV2 = session2
      ? session2.totalSize + (ignoreOptional ? 0 : session2.totalOptionalSize || 0)
      : 0
    const trueSizeDelta = sizeV2 - sizeV1

    const mandatorySizeV1 = session1?.totalSize || 0
    const mandatorySizeV2 = session2?.totalSize || 0
    const mandatorySizeDelta = mandatorySizeV2 - mandatorySizeV1

    let addedCount = 0
    let removedCount = 0
    for (const { status } of result) {
      if (status === 'added') {
        addedCount++
      }
      if (status === 'removed') {
        removedCount++
      }
    }

    post({
      type: 'result',
      id,
      result,
      summary: {
        sizeDelta: trueSizeDelta,
        mandatorySizeDelta,
        netDependencies: addedCount - removedCount,
        added: addedCount,
        removed: removedCount,
      },
    })
  } catch (error) {
    if (error instanceof AbortedError || controller.signal.aborted) {
      post({ type: 'aborted', id })
    } else {
      post({ type: 'error', id, message: error instanceof Error ? error.message : String(error) })
    }
  } finally {
    if (abortController === controller) {
      abortController = undefined
      inFlightId = undefined
    }
  }
})

function buildFlatMap(packages: PackageEntity[], optionalKeys: Set<string>) {
  const map = new Map<string, { version: string; size: number; isOptional: boolean }>()

  for (const pkg of packages) {
    const isOptional = optionalKeys.has(pkg.id)

    if (map.has(pkg.name)) {
      const existing = map.get(pkg.name)!
      existing.version = `${existing.version} + ${pkg.version}`
      existing.size += pkg.unpackedSize

      existing.isOptional = existing.isOptional && isOptional
    } else {
      map.set(pkg.name, { version: pkg.version, size: pkg.unpackedSize, isOptional })
    }
  }
  return map
}
