import type { NpmxPicksResponse } from '#shared/types/picks'
import {
  NPMX_LETTERS,
  ALGOLIA_POOL_SIZE,
  MIN_DOWNLOADS_LAST_30_DAYS,
  LIKES_SAMPLE_SIZE,
  selectPicks,
  type NpmxLetter,
  type PickCandidate,
} from '../utils/picks'

const PICKS_MAX_AGE_MS = 60 * 60 * 1000

/** Pick `n` random items from `arr` (Fisher-Yates on a copy, sliced). */
function randomSample<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy.slice(0, n)
}

interface AlgoliaHit {
  name: string
  downloadsLast30Days: number
  isDeprecated?: boolean
}

interface AlgoliaResponse {
  hits: AlgoliaHit[]
}

export default defineCachedEventHandler(
  async (): Promise<NpmxPicksResponse> => {
    const { appId, apiKey, indexName } = useRuntimeConfig().public.algolia

    // 1. Fetch popular packages from Algolia
    let algoliaHits: AlgoliaHit[] = []
    try {
      const algoliaResponse = await $fetch<AlgoliaResponse>(
        `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`,
        {
          method: 'POST',
          headers: {
            'X-Algolia-Application-Id': appId,
            'X-Algolia-API-Key': apiKey,
          },
          body: {
            query: '',
            hitsPerPage: ALGOLIA_POOL_SIZE,
            attributesToRetrieve: ['name', 'downloadsLast30Days', 'isDeprecated'],
            attributesToHighlight: [],
          },
        },
      )
      algoliaHits = algoliaResponse.hits ?? []
    } catch (error) {
      console.warn('[picks] Algolia fetch failed, falling back to empty pool', error)
      algoliaHits = []
    }

    // 2. Post-filter pool
    const pool = algoliaHits.filter(hit => {
      if (hit.isDeprecated) return false
      if (hit.downloadsLast30Days < MIN_DOWNLOADS_LAST_30_DAYS) return false
      return true
    })

    // 3. For each letter, find candidates and sample for likes checking
    const likesUtil = new PackageLikesUtils()

    const candidatesByLetter = {} as Record<NpmxLetter, PickCandidate[]>

    await Promise.all(
      NPMX_LETTERS.map(async letter => {
        const matching = pool.filter(hit => hit.name.toLowerCase().includes(letter))
        const sampled = randomSample(matching, LIKES_SAMPLE_SIZE)

        // Check likes in parallel
        const enriched: PickCandidate[] = await Promise.all(
          sampled.map(async hit => {
            try {
              const { totalLikes } = await likesUtil.getLikes(hit.name)
              return { name: hit.name, totalLikes }
            } catch {
              return { name: hit.name, totalLikes: 0 }
            }
          }),
        )

        candidatesByLetter[letter] = enriched
      }),
    )

    // 4. Select picks
    const picks = selectPicks(candidatesByLetter)

    return { picks }
  },
  {
    maxAge: PICKS_MAX_AGE_MS / 1000,
    swr: true,
    name: 'npmx-picks',
    getKey: () => 'picks',
  },
)
