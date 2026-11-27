/**
 * Deno Integration (WASM)
 *
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 * This runs entirely in Node.js without requiring a Deno subprocess.
 *
 * @module server/utils/docs/client
 */

import { doc, type DocNode } from '@deno/doc'
import type {
  DenoDocNode,
  DenoDocResult,
  DocEntry,
  DocsTruncationReason,
} from '#shared/types/deno-doc'
import { mapWithConcurrency } from '#shared/utils/async'
import { encodePackageName } from '#shared/utils/npm'
import { isBuiltin } from 'node:module'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_MAX_ENTRY_POINTS = 100
const DEFAULT_MAX_MODULE_FETCHES = 500
const DEFAULT_TIME_BUDGET_MS = 10_000
const DEFAULT_FETCH_TIMEOUT_MS = 5_000

const HEAD_CONCURRENCY = 6
const ENTRY_POINT_CONCURRENCY = 4

const IS_SOURCE_MAP = /\.(?:js|mjs|cjs|d\.[mc]?ts)\.map(?:[?#].*)?$/
const IS_NON_MODULE_EXPORT = /\.(?:css|scss|sass|less|json)$/i
const HAS_URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

const EXTERNAL_PROTOCOLS = new Set([
  'bun:',
  'cloudflare:',
  'deno:',
  'edge:',
  'ext:',
  'external:',
  'jsr:',
  'npm:',
  'virtual:',
  'workerd:',
])

const UNRESOLVABLE_BARE_SPECIFIERS = new Set(['bun', 'node'])

const TRUNCATION_PRIORITY: Record<DocsTruncationReason, number> = {
  'entry-limit': 1,
  'fetch-limit': 2,
  'timeout': 3,
  'upstream-error': 4,
}

export interface DocNodesOptions {
  maxEntryPoints?: number
  maxModuleFetches?: number
  timeBudgetMs?: number
  fetchTimeoutMs?: number
}

interface DocsStats {
  manifestFailed: boolean
  manifestTransientFailed: boolean
  headFailures: number
  headTransientFailures: number
  moduleFetches: number
  cacheHits: number
  skippedSpecifiers: number
  moduleFailures: number
  moduleTransientFailures: number
  entryFailures: number
  lastError?: string
}

function createStats(): DocsStats {
  return {
    manifestFailed: false,
    manifestTransientFailed: false,
    headFailures: 0,
    headTransientFailures: 0,
    moduleFetches: 0,
    cacheHits: 0,
    skippedSpecifiers: 0,
    moduleFailures: 0,
    moduleTransientFailures: 0,
    entryFailures: 0,
  }
}

function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const err = error as { statusCode?: unknown; status?: unknown; response?: { status?: unknown } }
  const status = err.statusCode ?? err.status ?? err.response?.status
  return typeof status === 'number' ? status : undefined
}

function isTransientError(error: unknown): boolean {
  const status = getErrorStatus(error)
  if (status !== undefined) {
    return isTransientStatus(status)
  }
  return true
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name
  }
  return String(error)
}

interface RequestFetchSignals {
  signal: AbortSignal
  perFetchSignal: AbortSignal
}

function createRequestFetchSignal(
  deadline: number,
  budgetSignal: AbortSignal,
  fetchTimeoutMs: number,
): RequestFetchSignals | null {
  if (budgetSignal.aborted) return null
  if (deadline - Date.now() <= 0) return null
  const perFetchSignal = AbortSignal.timeout(fetchTimeoutMs)
  return {
    signal: AbortSignal.any([budgetSignal, perFetchSignal]),
    perFetchSignal,
  }
}

function isUnresolvableBareSpecifier(specifier: string): boolean {
  return (
    UNRESOLVABLE_BARE_SPECIFIERS.has(specifier) ||
    specifier.startsWith('#') ||
    specifier.startsWith('~/') ||
    specifier.startsWith('~~/') ||
    specifier.startsWith('@/') ||
    specifier.startsWith('@@/')
  )
}

function logSummary(
  packageName: string,
  version: string,
  stats: DocsStats,
  documentedEntries: number,
  totalResolvedEntries: number,
  truncationReason: DocsTruncationReason | undefined,
): void {
  const totalFailures =
    (stats.manifestFailed ? 1 : 0) + stats.headFailures + stats.moduleFailures + stats.entryFailures
  if (totalFailures === 0 && !truncationReason) return

  const parts = [
    `[docs] ${packageName}@${version}:`,
    `${documentedEntries}/${totalResolvedEntries} entries,`,
    `${stats.moduleFetches} fetches (${stats.cacheHits} cached, ${stats.skippedSpecifiers} skipped),`,
    `${totalFailures} failures (head=${stats.headFailures}, module=${stats.moduleFailures}, entry=${stats.entryFailures})`,
  ]
  if (truncationReason) {
    parts.push(`truncated=${truncationReason}`)
  }
  if (stats.lastError) {
    parts.push(`lastError=${stats.lastError}`)
  }
  // eslint-disable-next-line no-console
  console.warn(parts.join(' '))
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Get documentation nodes for a package using @deno/doc WASM.
 */
export async function getDocNodes(
  packageName: string,
  version: string,
  options: DocNodesOptions = {},
): Promise<DenoDocResult> {
  const maxEntryPoints = options.maxEntryPoints ?? DEFAULT_MAX_ENTRY_POINTS
  const maxModuleFetches = options.maxModuleFetches ?? DEFAULT_MAX_MODULE_FETCHES
  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS

  const deadline = Date.now() + timeBudgetMs
  const budgetController = new AbortController()
  const budgetTimer = setTimeout(() => {
    budgetController.abort(new DOMException('Docs time budget exceeded', 'TimeoutError'))
  }, timeBudgetMs)

  const stats = createStats()
  let truncationReason: DocsTruncationReason | undefined

  const markTruncated = (reason: DocsTruncationReason) => {
    if (!truncationReason || TRUNCATION_PRIORITY[reason] > TRUNCATION_PRIORITY[truncationReason]) {
      truncationReason = reason
    }
  }

  const isBudgetExpired = () => budgetController.signal.aborted || Date.now() >= deadline

  try {
    const entryPoints = await resolveEntryPoints(
      packageName,
      version,
      maxEntryPoints,
      deadline,
      fetchTimeoutMs,
      budgetController.signal,
      stats,
      markTruncated,
    )

    if (entryPoints.length === 0) {
      logSummary(packageName, version, stats, 0, 0, truncationReason)
      if (
        truncationReason === 'timeout' ||
        stats.manifestTransientFailed ||
        stats.headTransientFailures > 0
      ) {
        throw new Error(
          `Failed to resolve documentation entry points for ${packageName}@${version}`,
        )
      }
      return { version: 1, entries: [] }
    }

    const cache = new Map<string, Promise<LoadResponse | undefined>>()
    const load = createLoader({
      cache,
      maxFetches: maxModuleFetches,
      deadline,
      fetchTimeoutMs,
      signal: budgetController.signal,
      stats,
      onTruncate: markTruncated,
    })
    const resolve = createResolver()

    const entries: (DocEntry | null)[] = await mapWithConcurrency(
      entryPoints,
      async ({ entryPoint, typesUrl }): Promise<DocEntry | null> => {
        if (isBudgetExpired()) {
          markTruncated('timeout')
          return null
        }

        const normalizedUrl = URL.parse(typesUrl)?.toString() ?? typesUrl
        if (stats.moduleFetches >= maxModuleFetches && !cache.has(normalizedUrl)) {
          markTruncated('fetch-limit')
          return null
        }

        let result: Record<string, DocNode[]>
        try {
          result = await doc([typesUrl], {
            load,
            resolve,
          })
        } catch (e) {
          stats.entryFailures++
          stats.lastError = formatError(e)
          if (isBudgetExpired()) {
            markTruncated('timeout')
          }
          return null
        }

        const nodes: DenoDocNode[] = []
        for (const docNodes of Object.values(result)) {
          nodes.push(...(docNodes as DenoDocNode[]))
        }

        if (nodes.length === 0) {
          return null
        }

        return { entryPoint, nodes }
      },
      ENTRY_POINT_CONCURRENCY,
    )

    const validEntries = entries.filter((entry): entry is DocEntry => entry !== null)
    const hasTransientFailure =
      stats.manifestTransientFailed ||
      stats.headTransientFailures > 0 ||
      stats.moduleTransientFailures > 0

    if (validEntries.length > 0 && hasTransientFailure) {
      markTruncated('upstream-error')
    }

    logSummary(
      packageName,
      version,
      stats,
      validEntries.length,
      entryPoints.length,
      truncationReason,
    )

    if (validEntries.length === 0 && (truncationReason === 'timeout' || hasTransientFailure)) {
      throw new Error(`Failed to generate documentation nodes for ${packageName}@${version}`)
    }

    return {
      version: 1,
      entries: validEntries,
      ...(truncationReason ? { truncated: true, truncationReason } : {}),
    }
  } finally {
    clearTimeout(budgetTimer)
  }
}

// =============================================================================
// Entry Point Resolution
// =============================================================================

interface ResolvedEntryPoint {
  entryPoint: string
  typesUrl: string
}

async function resolveEntryPoints(
  packageName: string,
  version: string,
  maxEntryPoints: number,
  deadline: number,
  fetchTimeoutMs: number,
  budgetSignal: AbortSignal,
  stats: DocsStats,
  markTruncated: (reason: DocsTruncationReason) => void,
): Promise<ResolvedEntryPoint[]> {
  let modules = await getModules(packageName, version, {
    deadline,
    fetchTimeoutMs,
    signal: budgetSignal,
    stats,
    onTruncate: markTruncated,
  })

  if (modules.length > maxEntryPoints) {
    modules = modules.slice(0, maxEntryPoints)
    markTruncated('entry-limit')
  }

  const resolved = await mapWithConcurrency(
    modules,
    async (entryPoint): Promise<ResolvedEntryPoint | null> => {
      const fetchSignals = createRequestFetchSignal(deadline, budgetSignal, fetchTimeoutMs)
      if (!fetchSignals) {
        markTruncated('timeout')
        return null
      }
      const submodule = entryPoint === '.' ? '' : entryPoint.replace(/^\./, '')
      const typesUrl = await getTypesUrl(
        packageName,
        version,
        submodule,
        fetchSignals,
        budgetSignal,
        stats,
      )
      if (budgetSignal.aborted) {
        markTruncated('timeout')
      }
      return typesUrl ? { entryPoint, typesUrl } : null
    },
    HEAD_CONCURRENCY,
  )

  return resolved.filter((entry): entry is ResolvedEntryPoint => entry !== null)
}

/** Minimal package manifest shape needed to resolve entry points. */
interface PackageManifest {
  name: string
  exports?: unknown
}

interface GetModulesOptions {
  deadline?: number
  fetchTimeoutMs?: number
  signal?: AbortSignal
  stats?: DocsStats
  onTruncate?: (reason: DocsTruncationReason) => void
}

/**
 * Resolve importable module specifiers for a package.
 *
 * @internal
 */
export async function getModules(
  packageName: string,
  version: string,
  options: GetModulesOptions = {},
): Promise<string[]> {
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const fetchSignals =
    options.deadline !== undefined && options.signal
      ? createRequestFetchSignal(options.deadline, options.signal, fetchTimeoutMs)
      : undefined
  if (fetchSignals === null) {
    options.onTruncate?.('timeout')
    return ['.']
  }

  let pkg: PackageManifest | undefined
  try {
    pkg = await $fetch<PackageManifest>(
      `https://esm.sh/${encodePackageName(packageName)}@${version}/package.json`,
      fetchSignals ? { signal: fetchSignals.signal } : { timeout: fetchTimeoutMs },
    )
  } catch (e) {
    const abortedByBudget = Boolean(
      options.signal?.aborted && !fetchSignals?.perFetchSignal.aborted,
    )
    if (abortedByBudget) {
      options.onTruncate?.('timeout')
    } else if (options.stats) {
      options.stats.manifestFailed = true
      if (isTransientError(e)) {
        options.stats.manifestTransientFailed = true
      }
      options.stats.lastError = formatError(e)
    }
    return ['.']
  }

  const exportsField = pkg?.exports
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return ['.']
  }

  // A bare conditions map (only `import`/`require`/...) describes the root entry.
  const subpathKeys = Object.keys(exportsField).filter(key => key === '.' || key.startsWith('./'))
  if (subpathKeys.length === 0) {
    return ['.']
  }

  return subpathKeys
    .filter(key => !key.includes('*') && !IS_NON_MODULE_EXPORT.test(key))
    .sort((a, b) => {
      if (a === b) return 0
      if (a === '.') return -1
      if (b === '.') return 1
      return a.localeCompare(b)
    })
}

// =============================================================================
// Module Loading
// =============================================================================

/** Load response for the doc() function */
interface LoadModuleResponse {
  kind: 'module'
  specifier: string
  headers?: Record<string, string>
  content: string
}

interface LoadExternalResponse {
  kind: 'external'
  specifier: string
}

export type LoadResponse = LoadModuleResponse | LoadExternalResponse

export interface LoaderOptions {
  cache?: Map<string, Promise<LoadResponse | undefined>>
  maxFetches?: number
  deadline?: number
  fetchTimeoutMs?: number
  signal?: AbortSignal
  stats?: DocsStats
  onTruncate?: (reason: DocsTruncationReason) => void
}

// @deno/doc mutates result.content in place, so return a fresh wrapper per read.
function cloneLoadResponse(response: LoadResponse | undefined): LoadResponse | undefined {
  if (!response) return undefined
  if (response.kind === 'module') {
    return {
      kind: 'module',
      specifier: response.specifier,
      headers: response.headers,
      content: response.content,
    }
  }
  return { kind: 'external', specifier: response.specifier }
}

/**
 * Create a memoized module loader for @deno/doc.
 *
 * Coalesces concurrent fetches for the same URL and enforces optional fetch
 * count and time budgets.
 */
export function createLoader(
  options: LoaderOptions = {},
): (
  specifier: string,
  isDynamic?: boolean,
  cacheSetting?: string,
  checksum?: string,
) => Promise<LoadResponse | undefined> {
  const cache = options.cache ?? new Map<string, Promise<LoadResponse | undefined>>()
  const maxFetches = options.maxFetches ?? Infinity
  const fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const stats = options.stats ?? createStats()

  return async (
    specifier: string,
    _isDynamic?: boolean,
    _cacheSetting?: string,
    _checksum?: string,
  ) => {
    if (IS_SOURCE_MAP.test(specifier)) {
      stats.skippedSpecifiers++
      return undefined
    }

    const url = URL.parse(specifier)
    if (url === null) {
      stats.skippedSpecifiers++
      return undefined
    }

    if (EXTERNAL_PROTOCOLS.has(url.protocol)) {
      stats.skippedSpecifiers++
      return { kind: 'external', specifier }
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      stats.skippedSpecifiers++
      return undefined
    }

    const key = url.toString()
    const cached = cache.get(key)
    if (cached) {
      stats.cacheHits++
      return cloneLoadResponse(await cached)
    }

    if (
      options.signal?.aborted ||
      (options.deadline !== undefined && Date.now() >= options.deadline)
    ) {
      options.onTruncate?.('timeout')
      return { kind: 'external', specifier }
    }

    if (stats.moduleFetches >= maxFetches) {
      options.onTruncate?.('fetch-limit')
      return { kind: 'external', specifier }
    }

    stats.moduleFetches++

    const fetchPromise: Promise<LoadResponse | undefined> = (async () => {
      const fetchSignals =
        options.deadline !== undefined && options.signal
          ? createRequestFetchSignal(options.deadline, options.signal, fetchTimeoutMs)
          : undefined
      if (fetchSignals === null) {
        options.onTruncate?.('timeout')
        return { kind: 'external', specifier }
      }

      try {
        const response = await $fetch.raw<Blob>(key, {
          method: 'GET',
          redirect: 'follow',
          ignoreResponseError: true,
          ...(fetchSignals ? { signal: fetchSignals.signal } : { timeout: fetchTimeoutMs }),
        })

        if (response.status !== 200) {
          stats.moduleFailures++
          if (isTransientStatus(response.status)) {
            stats.moduleTransientFailures++
          }
          stats.lastError = `HTTP ${response.status} ${key}`
          return undefined
        }

        // oxlint-disable-next-line eslint/no-underscore-dangle
        const content = (await response._data?.text()) ?? ''
        const headers: Record<string, string> = {}
        for (const [headerKey, value] of response.headers) {
          headers[headerKey.toLowerCase()] = value
        }

        const resolvedSpecifier = response.url || specifier
        const moduleResponse: LoadModuleResponse = {
          kind: 'module',
          specifier: resolvedSpecifier,
          headers,
          content,
        }

        if (resolvedSpecifier !== key && !cache.has(resolvedSpecifier)) {
          cache.set(resolvedSpecifier, Promise.resolve(moduleResponse))
        }

        return moduleResponse
      } catch (e) {
        const abortedByBudget = Boolean(
          options.signal?.aborted && !fetchSignals?.perFetchSignal.aborted,
        )
        if (abortedByBudget) {
          options.onTruncate?.('timeout')
          return { kind: 'external', specifier }
        }
        stats.moduleFailures++
        if (isTransientError(e)) {
          stats.moduleTransientFailures++
        }
        stats.lastError = formatError(e)
        return undefined
      }
    })()

    cache.set(key, fetchPromise)
    return cloneLoadResponse(await fetchPromise)
  }
}

/**
 * Create a module resolver for @deno/doc.
 *
 * Handles resolving relative imports and esm.sh redirects while leaving
 * runtime builtins and unresolvable specifiers external.
 */
export function createResolver(): (specifier: string, referrer: string) => string {
  return (specifier: string, referrer: string) => {
    if (IS_SOURCE_MAP.test(specifier)) {
      return specifier
    }

    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      return new URL(specifier, referrer).toString()
    }

    if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
      return specifier
    }

    if (specifier.startsWith('node:')) {
      return specifier
    }

    if (isBuiltin(specifier)) {
      return `node:${specifier}`
    }

    if (HAS_URL_SCHEME.test(specifier)) {
      return specifier
    }

    if (isUnresolvableBareSpecifier(specifier)) {
      return `external:${specifier}`
    }

    const baseUrl = URL.parse(referrer)
    if (baseUrl?.hostname === 'esm.sh') {
      return `https://esm.sh/${specifier}`
    }

    return specifier
  }
}

/**
 * Get the TypeScript types URL from esm.sh's x-typescript-types header.
 *
 * esm.sh serves types URL in the `x-typescript-types` header, not at the main URL.
 * Example: curl -sI 'https://esm.sh/ufo@1.5.0' returns header:
 *   x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
 */
async function getTypesUrl(
  packageName: string,
  version: string,
  submodule = '',
  fetchSignals?: RequestFetchSignals,
  budgetSignal?: AbortSignal,
  stats?: DocsStats,
): Promise<string | null> {
  const url = `https://esm.sh/${encodePackageName(packageName)}@${version}${submodule}`

  try {
    const response = await $fetch.raw(url, {
      method: 'HEAD',
      ignoreResponseError: true,
      ...(fetchSignals ? { signal: fetchSignals.signal } : { timeout: DEFAULT_FETCH_TIMEOUT_MS }),
    })
    if (response.status >= 400) {
      if (stats) {
        stats.headFailures++
        if (isTransientStatus(response.status)) {
          stats.headTransientFailures++
        }
        stats.lastError = `HEAD ${response.status} ${url}`
      }
      return null
    }
    return response.headers.get('x-typescript-types')
  } catch (e) {
    const abortedByBudget = Boolean(budgetSignal?.aborted && !fetchSignals?.perFetchSignal.aborted)
    if (!abortedByBudget && stats) {
      stats.headFailures++
      if (isTransientError(e)) {
        stats.headTransientFailures++
      }
      stats.lastError = formatError(e)
    }
    return null
  }
}
