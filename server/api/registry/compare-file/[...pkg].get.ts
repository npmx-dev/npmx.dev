import * as v from 'valibot'
import { PackageFileDiffQuerySchema } from '#shared/schemas/package'
import type { FileDiffResponse, DiffHunk } from '#shared/types'
import { CACHE_MAX_AGE_ONE_YEAR } from '#shared/utils/constants'
import { createDiff, insertSkipBlocks, countDiffStats } from '#server/utils/diff'

const CACHE_VERSION = 1
const DIFF_TIMEOUT = 15000 // 15 sec

/** Maximum file size for diffing (250KB - smaller than viewing since we diff two files) */
const MAX_DIFF_FILE_SIZE = 250 * 1024

/**
 * Parse the version range from the URL.
 * Supports formats like: "1.0.0...2.0.0" or "1.0.0..2.0.0"
 */
function parseVersionRange(versionRange: string): { from: string; to: string } | null {
  // Try triple dot first (GitHub style)
  let parts = versionRange.split('...')
  if (parts.length === 2) {
    return { from: parts[0]!, to: parts[1]! }
  }

  // Try double dot
  parts = versionRange.split('..')
  if (parts.length === 2) {
    return { from: parts[0]!, to: parts[1]! }
  }

  return null
}

/**
 * Fetch file content from jsDelivr with size check
 */
async function fetchFileContentForDiff(
  packageName: string,
  version: string,
  filePath: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DIFF_TIMEOUT)
  if (signal) {
    signal.addEventListener('abort', () => controller.abort(signal.reason as any), { once: true })
  }

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      if (response.status === 404) return null
      throw createError({
        statusCode: response.status >= 500 ? 502 : response.status,
        message: `Failed to fetch file (${response.status})`,
      })
    }

    const contentLength = response.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_DIFF_FILE_SIZE) {
      throw createError({
        statusCode: 413,
        message: `File too large to diff (${(parseInt(contentLength, 10) / 1024).toFixed(0)}KB). Maximum is ${MAX_DIFF_FILE_SIZE / 1024}KB.`,
      })
    }

    const content = await response.text()

    if (content.length > MAX_DIFF_FILE_SIZE) {
      throw createError({
        statusCode: 413,
        message: `File too large to diff (${(content.length / 1024).toFixed(0)}KB). Maximum is ${MAX_DIFF_FILE_SIZE / 1024}KB.`,
      })
    }

    return content
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    if ((error as Error)?.name === 'AbortError') {
      throw createError({
        statusCode: 504,
        message: 'Diff request timed out while fetching file',
      })
    }
    throw createError({
      statusCode: 502,
      message: 'Failed to fetch file for diff',
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Get diff for a specific file between two versions.
 *
 * URL patterns:
 * - /api/registry/compare-file/packageName/v/1.0.0...2.0.0/path/to/file.ts
 * - /api/registry/compare-file/@scope/packageName/v/1.0.0...2.0.0/path/to/file.ts
 */
export default defineCachedEventHandler(
  async event => {
    const startTime = Date.now()

    // Parse package segments
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName, rawVersion: fullPathAfterV } = parsePackageParams(pkgParamSegments)

    // Split version range and file path
    // fullPathAfterV => "1.0.0...2.0.0/dist/index.mjs"
    const versionSegments = fullPathAfterV?.split('/') ?? []

    if (versionSegments.length < 2) {
      throw createError({
        statusCode: 400,
        message: 'Version range and file path are required',
      })
    }

    // First segment contains the version range
    const rawVersionRange = versionSegments[0]!
    const rawFilePath = versionSegments.slice(1).join('/')

    // Parse version range
    const range = parseVersionRange(rawVersionRange)
    if (!range) {
      throw createError({
        statusCode: 400,
        message: 'Invalid version range format. Use from...to (e.g., 1.0.0...2.0.0)',
      })
    }

    try {
      // Validate inputs
      const { packageName, fromVersion, toVersion, filePath } = v.parse(
        PackageFileDiffQuerySchema,
        {
          packageName: rawPackageName,
          fromVersion: range.from,
          toVersion: range.to,
          filePath: rawFilePath,
        },
      )

      // Set up abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), DIFF_TIMEOUT)

      try {
        // Get diff options from query params
        const query = getQuery(event)
        const diffOptions = {
          mergeModifiedLines: query.mergeModifiedLines !== 'false',
          maxChangeRatio: parseFloat(query.maxChangeRatio as string) || 0.45,
          maxDiffDistance: parseInt(query.maxDiffDistance as string, 10) || 30,
          inlineMaxCharEdits: parseInt(query.inlineMaxCharEdits as string, 10) || 2,
        }

        // Fetch file contents in parallel
        const [fromContent, toContent] = await Promise.all([
          fetchFileContentForDiff(packageName, fromVersion, filePath, controller.signal),
          fetchFileContentForDiff(packageName, toVersion, filePath, controller.signal),
        ])

        clearTimeout(timeoutId)

        // Determine file type
        let type: 'add' | 'delete' | 'modify'
        if (fromContent === null && toContent === null) {
          throw createError({
            statusCode: 404,
            message: 'File not found in either version',
          })
        } else if (fromContent === null) {
          type = 'add'
        } else if (toContent === null) {
          type = 'delete'
        } else {
          type = 'modify'
        }

        // Create diff with options
        const diff = createDiff(fromContent ?? '', toContent ?? '', filePath, diffOptions)

        if (!diff) {
          // No changes (shouldn't happen but handle it)
          return {
            package: packageName,
            from: fromVersion,
            to: toVersion,
            path: filePath,
            type,
            hunks: [],
            stats: { additions: 0, deletions: 0 },
            meta: { computeTime: Date.now() - startTime },
          } satisfies FileDiffResponse
        }

        // Insert skip blocks and count stats
        const hunkOnly = diff.hunks.filter((h): h is DiffHunk => h.type === 'hunk')
        const hunksWithSkips = insertSkipBlocks(hunkOnly)
        const stats = countDiffStats(hunksWithSkips)

        return {
          package: packageName,
          from: fromVersion,
          to: toVersion,
          path: filePath,
          type,
          hunks: hunksWithSkips,
          stats,
          meta: { computeTime: Date.now() - startTime },
        } satisfies FileDiffResponse
      } catch (error) {
        clearTimeout(timeoutId)

        // Check if it was a timeout
        if (error instanceof Error && error.name === 'AbortError') {
          throw createError({
            statusCode: 504,
            message: 'Diff computation timed out',
          })
        }

        throw error
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to compute file diff',
      })
    }
  },
  {
    // Diff between specific versions never changes - cache permanently
    maxAge: CACHE_MAX_AGE_ONE_YEAR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)
      const optionsKey = `${query.mergeModifiedLines}:${query.maxChangeRatio}:${query.maxDiffDistance}:${query.inlineMaxCharEdits}`
      return `compare-file:v${CACHE_VERSION}:${pkg.replace(/\/+$/, '').trim()}:${optionsKey}`
    },
  },
)
