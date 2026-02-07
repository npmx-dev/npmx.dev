import { createTwoFilesPatch } from 'diff'
import type {
  DiffLine,
  DiffLineSegment,
  DiffHunk,
  DiffSkipBlock,
  FileDiff,
} from '#shared/types/compare'

/** Options for parsing diffs */
export interface ParseOptions {
  maxDiffDistance: number
  maxChangeRatio: number
  mergeModifiedLines: boolean
  inlineMaxCharEdits: number
}

const defaultOptions: ParseOptions = {
  maxDiffDistance: 30,
  maxChangeRatio: 0.45,
  mergeModifiedLines: true,
  inlineMaxCharEdits: 2,
}

interface RawChange {
  type: 'insert' | 'delete' | 'normal'
  content: string
  lineNumber?: number
  oldLineNumber?: number
  newLineNumber?: number
  isNormal?: boolean
}

function calculateChangeRatio(a: string, b: string): number {
  const totalChars = a.length + b.length
  if (totalChars === 0) return 1
  let changedChars = 0
  const maxLen = Math.max(a.length, b.length)
  for (let i = 0; i < maxLen; i++) {
    if (a[i] !== b[i]) changedChars++
  }
  changedChars += Math.abs(a.length - b.length)
  return changedChars / totalChars
}

function isSimilarEnough(a: string, b: string, maxChangeRatio: number): boolean {
  if (maxChangeRatio <= 0) return a === b
  if (maxChangeRatio >= 1) return true
  return calculateChangeRatio(a, b) <= maxChangeRatio
}

function buildInlineDiffSegments(
  oldContent: string,
  newContent: string,
  _options: ParseOptions,
): DiffLineSegment[] {
  const oldWords = oldContent.split(/(\s+)/)
  const newWords = newContent.split(/(\s+)/)

  const segments: DiffLineSegment[] = []
  let oi = 0
  let ni = 0

  while (oi < oldWords.length || ni < newWords.length) {
    if (oi >= oldWords.length) {
      segments.push({ value: newWords.slice(ni).join(''), type: 'insert' })
      break
    }
    if (ni >= newWords.length) {
      segments.push({ value: oldWords.slice(oi).join(''), type: 'delete' })
      break
    }

    if (oldWords[oi] === newWords[ni]) {
      const last = segments[segments.length - 1]
      if (last?.type === 'normal') {
        last.value += oldWords[oi]!
      } else {
        segments.push({ value: oldWords[oi]!, type: 'normal' })
      }
      oi++
      ni++
    } else {
      let foundSync = false

      for (let look = 1; look <= 3 && ni + look < newWords.length; look++) {
        if (newWords[ni + look] === oldWords[oi]) {
          segments.push({ value: newWords.slice(ni, ni + look).join(''), type: 'insert' })
          ni += look
          foundSync = true
          break
        }
      }

      if (!foundSync) {
        for (let look = 1; look <= 3 && oi + look < oldWords.length; look++) {
          if (oldWords[oi + look] === newWords[ni]) {
            segments.push({ value: oldWords.slice(oi, oi + look).join(''), type: 'delete' })
            oi += look
            foundSync = true
            break
          }
        }
      }

      if (!foundSync) {
        segments.push({ value: oldWords[oi]!, type: 'delete' })
        segments.push({ value: newWords[ni]!, type: 'insert' })
        oi++
        ni++
      }
    }
  }

  const merged: DiffLineSegment[] = []
  for (const seg of segments) {
    const last = merged[merged.length - 1]
    if (last?.type === seg.type) {
      last.value += seg.value
    } else {
      merged.push({ ...seg })
    }
  }

  return merged
}

function changeToLine(change: RawChange): DiffLine {
  return {
    type: change.type,
    oldLineNumber: change.oldLineNumber,
    newLineNumber: change.newLineNumber,
    lineNumber: change.lineNumber,
    content: [{ value: change.content, type: 'normal' }],
  }
}

function mergeAdjacentLines(changes: RawChange[], options: ParseOptions): DiffLine[] {
  const out: DiffLine[] = []

  for (let i = 0; i < changes.length; i++) {
    const current = changes[i]!
    const next = changes[i + 1]

    if (
      next &&
      current.type === 'delete' &&
      next.type === 'insert' &&
      isSimilarEnough(current.content, next.content, options.maxChangeRatio)
    ) {
      out.push({
        type: 'normal',
        oldLineNumber: current.lineNumber,
        newLineNumber: next.lineNumber,
        content: buildInlineDiffSegments(current.content, next.content, options),
      })
      i++
    } else {
      out.push(changeToLine(current))
    }
  }

  return out
}

export function parseUnifiedDiff(
  diffText: string,
  options: Partial<ParseOptions> = {},
): FileDiff[] {
  const opts = { ...defaultOptions, ...options }
  const files: FileDiff[] = []

  const lines = diffText.split('\n')
  let currentFile: FileDiff | null = null
  let currentHunk: {
    changes: RawChange[]
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    content: string
  } | null = null
  let oldLine = 0
  let newLine = 0

  // Track old path from --- line to detect /dev/null (new/deleted files)
  let lastOldPath = ''

  for (const line of lines) {
    if (line.startsWith('---')) {
      if (currentHunk && currentFile) {
        const hunk = processHunk(currentHunk, opts)
        currentFile.hunks.push(hunk)
      }
      currentHunk = null
      const oldMatch = line.match(/^--- (?:a\/)?(.*)/)
      lastOldPath = oldMatch?.[1]?.trimEnd() ?? ''
      continue
    }

    if (line.startsWith('+++')) {
      const match = line.match(/^\+\+\+ (?:b\/)?(.*)/)
      const path = match?.[1]?.trimEnd() ?? ''

      if (currentFile && currentHunk) {
        const hunk = processHunk(currentHunk, opts)
        currentFile.hunks.push(hunk)
        files.push(currentFile)
      } else if (currentFile) {
        files.push(currentFile)
      }

      // Determine file type from --- / +++ paths:
      // /dev/null in the old path means a new file; in the new path means deleted
      let fileType: FileDiff['type'] = 'modify'
      if (lastOldPath === '/dev/null') fileType = 'add'
      else if (path === '/dev/null') fileType = 'delete'

      currentFile = {
        oldPath: lastOldPath === '/dev/null' ? path : lastOldPath || path,
        newPath: path,
        type: fileType,
        hunks: [],
      }
      currentHunk = null
      lastOldPath = ''
      continue
    }

    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/)
    if (hunkMatch) {
      if (currentHunk && currentFile) {
        const hunk = processHunk(currentHunk, opts)
        currentFile.hunks.push(hunk)
      }

      oldLine = parseInt(hunkMatch[1]!, 10)
      newLine = parseInt(hunkMatch[3]!, 10)

      currentHunk = {
        changes: [],
        oldStart: oldLine,
        oldLines: parseInt(hunkMatch[2] ?? '1', 10),
        newStart: newLine,
        newLines: parseInt(hunkMatch[4] ?? '1', 10),
        content: line,
      }
      continue
    }

    if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('\\')) {
      continue
    }

    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.changes.push({
          type: 'insert',
          content: line.slice(1),
          lineNumber: newLine,
          newLineNumber: newLine,
        })
        newLine++
      } else if (line.startsWith('-')) {
        currentHunk.changes.push({
          type: 'delete',
          content: line.slice(1),
          lineNumber: oldLine,
          oldLineNumber: oldLine,
        })
        oldLine++
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.changes.push({
          type: 'normal',
          content: line.slice(1) || '',
          oldLineNumber: oldLine,
          newLineNumber: newLine,
          isNormal: true,
        })
        oldLine++
        newLine++
      }
    }
  }

  if (currentHunk && currentFile) {
    const hunk = processHunk(currentHunk, opts)
    currentFile.hunks.push(hunk)
  }
  if (currentFile) {
    files.push(currentFile)
  }

  return files
}

function processHunk(
  raw: {
    changes: RawChange[]
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    content: string
  },
  options: ParseOptions,
): DiffHunk {
  const lines = options.mergeModifiedLines
    ? mergeAdjacentLines(raw.changes, options)
    : raw.changes.map(changeToLine)

  return {
    type: 'hunk',
    content: raw.content,
    oldStart: raw.oldStart,
    oldLines: raw.oldLines,
    newStart: raw.newStart,
    newLines: raw.newLines,
    lines,
  }
}

export function insertSkipBlocks(hunks: DiffHunk[]): (DiffHunk | DiffSkipBlock)[] {
  const result: (DiffHunk | DiffSkipBlock)[] = []
  let lastHunkLine = 1

  for (const hunk of hunks) {
    const distanceToLastHunk = hunk.oldStart - lastHunkLine

    if (distanceToLastHunk > 0) {
      result.push({
        type: 'skip',
        count: distanceToLastHunk,
        content: `${distanceToLastHunk} lines hidden`,
      })
    }

    lastHunkLine = Math.max(hunk.oldStart + hunk.oldLines, lastHunkLine)
    result.push(hunk)
  }

  return result
}

export function createDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
  options: Partial<ParseOptions> = {},
): FileDiff | null {
  const diffText = createTwoFilesPatch(
    `a/${filePath}`,
    `b/${filePath}`,
    oldContent,
    newContent,
    '',
    '',
    { context: 3 },
  )

  const files = parseUnifiedDiff(diffText, options)
  return files[0] ?? null
}

export function countDiffStats(hunks: (DiffHunk | DiffSkipBlock)[]): {
  additions: number
  deletions: number
} {
  let additions = 0
  let deletions = 0

  for (const hunk of hunks) {
    if (hunk.type === 'hunk') {
      for (const line of hunk.lines) {
        if (line.type === 'insert') additions++
        else if (line.type === 'delete') deletions++
      }
    }
  }

  return { additions, deletions }
}
