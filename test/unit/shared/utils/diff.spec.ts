import { describe, expect, it } from 'vitest'
import { truncateDiffHunks } from '#shared/utils/diff'
import type { DiffHunk, DiffSkipBlock } from '#shared/types/compare'

function createHunk(lineCount: number): DiffHunk {
  return {
    type: 'hunk',
    content: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: lineCount,
    newStart: 1,
    newLines: lineCount,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      type: 'normal',
      oldLineNumber: index + 1,
      newLineNumber: index + 1,
      content: [{ value: `line ${index + 1}`, type: 'normal' }],
    })),
  }
}

describe('truncateDiffHunks', () => {
  it('leaves hunks untouched when they fit within the line budget', () => {
    const hunk = createHunk(2)

    const result = truncateDiffHunks([hunk], 3)

    expect(result.truncated).toBe(false)
    expect(result.hunks).toEqual([hunk])
  })

  it('truncates hunk lines when the line budget is exceeded', () => {
    const result = truncateDiffHunks([createHunk(4)], 2)

    expect(result.truncated).toBe(true)
    expect(result.hunks).toHaveLength(1)
    expect(result.hunks[0]?.type).toBe('hunk')
    expect((result.hunks[0] as DiffHunk).lines).toHaveLength(2)
  })

  it('does not count skip blocks against the line budget', () => {
    const skip: DiffSkipBlock = {
      type: 'skip',
      count: 10,
      content: '10 lines hidden',
    }

    const result = truncateDiffHunks([skip, createHunk(2)], 1)

    expect(result.truncated).toBe(true)
    expect(result.hunks[0]).toBe(skip)
    expect((result.hunks[1] as DiffHunk).lines).toHaveLength(1)
  })

  it('does not append a skip block after the line budget is exhausted', () => {
    const skip: DiffSkipBlock = {
      type: 'skip',
      count: 10,
      content: '10 lines hidden',
    }
    const hunk = createHunk(1)

    const result = truncateDiffHunks([hunk, skip], 1)

    expect(result.truncated).toBe(true)
    expect(result.hunks).toEqual([hunk])
  })
})
