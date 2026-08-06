import * as v from 'valibot'
import { PackageFileDiffQuerySchema } from '#shared/schemas/package'
import { countDiffStats, createDiff, insertSkipBlocks, truncateDiffHunks } from '#shared/utils/diff'
import type { DiffHunk, DiffSkipBlock } from '#shared/types/compare'

const CACHE_VERSION = 3
const DIFF_TIMEOUT = 15000 // 15 sec

/** Files above this size use a cheaper plain-text diff renderer. */
const LARGE_DIFF_MODE_BYTES = 250 * 1024
/** Maximum file size for modified-file diffs. */
const MAX_MODIFIED_DIFF_INPUT_BYTES = 1024 * 1024
/** Maximum file size for added/removed-file diffs, which render the whole file. */
const MAX_SINGLE_SIDED_DIFF_INPUT_BYTES = LARGE_DIFF_MODE_BYTES
/** Maximum number of changed/context lines returned to the client. */
const MAX_DIFF_OUTPUT_LINES = 5000
/** Maximum rendered diff lines we'll syntax-highlight. */
const MAX_HIGHLIGHT_DIFF_LINES = 1000
/** Maximum rendered diff text we'll syntax-highlight. */
const MAX_HIGHLIGHT_DIFF_BYTES = 128 * 1024

function byteLength(content: string): number {
  return Buffer.byteLength(content, 'utf8')
}

function countRenderableDiffLines(hunks: (DiffHunk | DiffSkipBlock)[]): number {
  let count = 0

  for (const hunk of hunks) {
    if (hunk.type === 'hunk') count += hunk.lines.length
  }

  return count
}

function countRenderableDiffBytes(hunks: (DiffHunk | DiffSkipBlock)[]): number {
  let count = 0

  for (const hunk of hunks) {
    if (hunk.type !== 'hunk') continue
    for (const line of hunk.lines) {
      for (const segment of line.content) {
        count += byteLength(segment.value)
      }
      count += 1
    }
  }

  return count
}

/**
 * Fetch file content from jsDelivr with size check
 */
async function fetchFileContentForDiff(
  packageName: string,
  version: string,
  filePath: string,
  maxBytes: number,
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
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      throw createError({
        statusCode: 413,
        message: `File too large to diff (${(parseInt(contentLength, 10) / 1024).toFixed(0)}KB). Maximum is ${maxBytes / 1024}KB.`,
      })
    }

    const content = await response.text()

    if (byteLength(content) > maxBytes) {
      throw createError({
        statusCode: 413,
        message: `File too large to diff (${(byteLength(content) / 1024).toFixed(0)}KB). Maximum is ${maxBytes / 1024}KB.`,
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
          fetchFileContentForDiff(
            packageName,
            fromVersion,
            filePath,
            MAX_MODIFIED_DIFF_INPUT_BYTES,
            controller.signal,
          ),
          fetchFileContentForDiff(
            packageName,
            toVersion,
            filePath,
            MAX_MODIFIED_DIFF_INPUT_BYTES,
            controller.signal,
          ),
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

        const fromSize = fromContent === null ? 0 : byteLength(fromContent)
        const toSize = toContent === null ? 0 : byteLength(toContent)
        const largestSize = Math.max(fromSize, toSize)

        if (type !== 'modify' && largestSize > MAX_SINGLE_SIDED_DIFF_INPUT_BYTES) {
          throw createError({
            statusCode: 413,
            message: `File too large to diff (${(largestSize / 1024).toFixed(0)}KB). Maximum is ${MAX_SINGLE_SIDED_DIFF_INPUT_BYTES / 1024}KB for added or removed files.`,
          })
        }

        const large = largestSize > LARGE_DIFF_MODE_BYTES
        const effectiveDiffOptions = large
          ? {
              ...diffOptions,
              mergeModifiedLines: false,
            }
          : diffOptions

        // Create diff with options
        const diff = createDiff(fromContent ?? '', toContent ?? '', filePath, effectiveDiffOptions)

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
            meta: { large, computeTime: Date.now() - startTime },
          } satisfies FileDiffResponse
        }

        // Insert skip blocks and count stats
        const hunkOnly = diff.hunks.filter((h): h is DiffHunk => h.type === 'hunk')
        const hunksWithSkips = insertSkipBlocks(hunkOnly)
        const stats = countDiffStats(hunksWithSkips)
        const { hunks, truncated } = truncateDiffHunks(hunksWithSkips, MAX_DIFF_OUTPUT_LINES)
        const shouldHighlight =
          !truncated &&
          countRenderableDiffLines(hunks) <= MAX_HIGHLIGHT_DIFF_LINES &&
          countRenderableDiffBytes(hunks) <= MAX_HIGHLIGHT_DIFF_BYTES

        // Syntax-highlight diff segments using server-side Shiki
        const language = getLanguageFromPath(filePath)
        const shiki = shouldHighlight ? await getShikiHighlighter() : null
        const loadedLangs = shiki?.getLoadedLanguages() ?? []

        if (shiki && loadedLangs.includes(language as never)) {
          for (const hunk of hunks) {
            if (hunk.type !== 'hunk') continue
            for (const line of hunk.lines) {
              line.content = line.content.map(seg => {
                const code = seg.value.length ? seg.value : ' '
                try {
                  const raw = shiki.codeToHtml(code, {
                    lang: language,
                    themes: { light: 'github-light', dark: 'github-dark' },
                    defaultColor: 'dark',
                  })
                  const html = raw.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1]
                  return html ? Object.assign({}, seg, { html }) : seg
                } catch {
                  return seg
                }
              })
            }
          }
        }

        return {
          package: packageName,
          from: fromVersion,
          to: toVersion,
          path: filePath,
          type,
          hunks,
          stats,
          meta: {
            large,
            truncated,
            truncationReason: truncated ? 'too_many_lines' : undefined,
            computeTime: Date.now() - startTime,
          },
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
      // Normalize option values to prevent cache pollution from arbitrary floats.
      // These match the parsing logic used in the handler body.
      const merge = query.mergeModifiedLines !== 'false'
      const ratio = Math.round((parseFloat(query.maxChangeRatio as string) || 0.45) * 100)
      const distance = parseInt(query.maxDiffDistance as string, 10) || 30
      const charEdits = parseInt(query.inlineMaxCharEdits as string, 10) || 2
      const optionsKey = `${merge}:${ratio}:${distance}:${charEdits}`
      return `compare-file:v${CACHE_VERSION}:${pkg.replace(/\/+$/, '').trim()}:${optionsKey}`
    },
  },
)
