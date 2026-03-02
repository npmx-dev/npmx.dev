import type { NpmxPick } from '#shared/types/picks'

export const NPMX_LETTERS = ['n', 'p', 'm', 'x'] as const
export type NpmxLetter = (typeof NPMX_LETTERS)[number]

export const MIN_LIKES = 5
export const MIN_DOWNLOADS_LAST_30_DAYS = 10_000
export const ALGOLIA_POOL_SIZE = 500
export const LIKES_SAMPLE_SIZE = 30

/** Hardcoded last-resort fallbacks in case we fail to find any candidates for a letter. */
export const FALLBACKS: Record<NpmxLetter, string> = {
  n: 'nuxt',
  p: 'pnpm',
  m: 'module-replacements',
  x: 'oxfmt',
}

export interface PickCandidate {
  name: string
  totalLikes?: number
}

/**
 * Select one pick per NPMX letter from pre-filtered candidates.
 * Prefers candidates with `totalLikes >= MIN_LIKES`; falls back to any
 * candidate; falls back to hardcoded fallback.
 */
export function selectPicks(candidatesByLetter: Record<NpmxLetter, PickCandidate[]>): NpmxPick[] {
  const used = new Set<string>()
  const picks: NpmxPick[] = []

  for (const letter of NPMX_LETTERS) {
    const candidates = candidatesByLetter[letter] ?? []

    const liked = candidates.filter(c => (c.totalLikes ?? 0) >= MIN_LIKES && !used.has(c.name))
    const nonLiked = candidates.filter(c => (c.totalLikes ?? 0) < MIN_LIKES && !used.has(c.name))

    const pool = liked.length > 0 ? liked : nonLiked
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const name = pick?.name ?? FALLBACKS[letter]

    used.add(name)
    picks.push({
      letter,
      name,
      letterIndex: name.toLowerCase().indexOf(letter),
    })
  }

  return picks
}
