import { describe, expect, it } from 'vitest'
import {
  selectPicks,
  FALLBACKS,
  MIN_LIKES,
  type PickCandidate,
  type NpmxLetter,
} from '../../../../server/utils/picks'

describe('selectPicks', () => {
  it('returns 4 picks, one per letter', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [{ name: 'next', totalLikes: 10 }],
      p: [{ name: 'pnpm', totalLikes: 10 }],
      m: [{ name: 'mocha', totalLikes: 10 }],
      x: [{ name: 'oxfmt', totalLikes: 10 }],
    }
    const picks = selectPicks(candidates)
    expect(picks).toHaveLength(4)
    expect(picks.map(p => p.letter)).toEqual(['n', 'p', 'm', 'x'])
  })

  it('sets letterIndex correctly', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [{ name: 'next', totalLikes: 10 }],
      p: [{ name: 'webpack', totalLikes: 10 }],
      m: [{ name: 'commander', totalLikes: 10 }],
      x: [{ name: 'luxon', totalLikes: 10 }],
    }
    const picks = selectPicks(candidates)

    expect(picks).toHaveLength(4)
    expect(picks[0]?.letterIndex).toBe('next'.indexOf('n'))
    expect(picks[1]?.letterIndex).toBe('webpack'.indexOf('p'))
    expect(picks[2]?.letterIndex).toBe('commander'.indexOf('m'))
    expect(picks[3]?.letterIndex).toBe('luxon'.indexOf('x'))
  })

  it('prefers liked candidates over non-liked', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [
        { name: 'non-liked-n', totalLikes: 0 },
        { name: 'liked-n', totalLikes: MIN_LIKES },
      ],
      p: [{ name: 'pkg-p', totalLikes: 0 }],
      m: [{ name: 'pkg-m', totalLikes: 0 }],
      x: [{ name: 'pkg-x', totalLikes: 0 }],
    }

    // Run multiple times — liked should always win for 'n'
    for (let i = 0; i < 20; i++) {
      const picks = selectPicks(candidates)
      expect(picks[0]!.name).toBe('liked-n')
    }
  })

  it('falls back to non-liked when no liked candidates exist', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [{ name: 'nodemon', totalLikes: 2 }],
      p: [{ name: 'prettier', totalLikes: 0 }],
      m: [{ name: 'mocha', totalLikes: 1 }],
      x: [{ name: 'luxon', totalLikes: 0 }],
    }
    const picks = selectPicks(candidates)
    expect(picks).toHaveLength(4)
    expect(picks[0]?.name).toBe('nodemon')
    expect(picks[1]?.name).toBe('prettier')
    expect(picks[2]?.name).toBe('mocha')
    expect(picks[3]?.name).toBe('luxon')
  })

  it('falls back to hardcoded fallbacks when no candidates at all', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [],
      p: [],
      m: [],
      x: [],
    }
    const picks = selectPicks(candidates)
    expect(picks).toHaveLength(4)
    expect(picks[0]?.name).toBe(FALLBACKS.n)
    expect(picks[1]?.name).toBe(FALLBACKS.p)
    expect(picks[2]?.name).toBe(FALLBACKS.m)
    expect(picks[3]?.name).toBe(FALLBACKS.x)
  })

  it('falls back to hardcoded fallbacks when the request to Algolia fails', () => {
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [],
      p: [],
      m: [],
      x: [],
    }
    const picks = selectPicks(candidates)
    expect(picks).toHaveLength(4)
    expect(picks[0]?.name).toBe(FALLBACKS.n)
    expect(picks[1]?.name).toBe(FALLBACKS.p)
    expect(picks[2]?.name).toBe(FALLBACKS.m)
    expect(picks[3]?.name).toBe(FALLBACKS.x)
  })

  it('does not duplicate packages across picks', () => {
    // 'npm' contains n, p, and m — should only be used once
    const candidates: Record<NpmxLetter, PickCandidate[]> = {
      n: [{ name: 'npm', totalLikes: 10 }],
      p: [
        { name: 'npm', totalLikes: 10 },
        { name: 'prettier', totalLikes: 10 },
      ],
      m: [
        { name: 'npm', totalLikes: 10 },
        { name: 'mocha', totalLikes: 10 },
      ],
      x: [{ name: 'luxon', totalLikes: 10 }],
    }
    const picks = selectPicks(candidates)
    const names = picks.map(p => p.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
