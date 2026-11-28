import { Client } from '@atproto/lex'
import * as app from '#shared/types/lexicons/app'
import { BLUESKY_API, CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

// Bluesky's own moderation service. We don't run a labeler, so we borrow its account labels.
export const BLUESKY_MODERATION_DID = 'did:plc:ar7c4by46qjdydhdevvrndac'
const HIDING_ACCOUNT_LABELS: ReadonlySet<string> = new Set(['!hide', '!takedown', 'spam'])

const CACHE_KEY = (did: string) => `atproto-moderation:${did}:hidden`
// getProfiles accepts at most 25 actors per call
const PROFILES_BATCH_SIZE = 25
const LABELS_TIMEOUT_MS = 3_000

type Label = { src: string; val: string; neg?: boolean; exp?: string }
export type FetchProfileLabels = (
  dids: string[],
) => Promise<Array<{ did: string; labels?: Label[] }>>

const defaultFetchProfileLabels: FetchProfileLabels = async dids => {
  const client = new Client({ service: BLUESKY_API })
  const { profiles } = await client.call(
    app.bsky.actor.getProfiles,
    { actors: dids as `did:${string}:${string}`[] },
    // Collection reads wait on this; past the timeout we fail open
    { signal: AbortSignal.timeout(LABELS_TIMEOUT_MS) },
  )
  return profiles
}

export function isHiddenByLabels(labels: Label[] | undefined, now = Date.now()): boolean {
  return (labels ?? []).some(
    label =>
      label.src === BLUESKY_MODERATION_DID &&
      !label.neg &&
      HIDING_ACCOUNT_LABELS.has(label.val) &&
      (!label.exp || Date.parse(label.exp) > now),
  )
}

/**
 * Decides which accounts' collections to hide, based on Bluesky moderation labels.
 * Fails open: if the AppView is unreachable we show content rather than hide everything.
 */
export class AccountModerationUtils {
  private readonly fetchProfileLabels: FetchProfileLabels
  private readonly cache: CacheAdapter

  constructor(deps?: { fetchProfileLabels?: FetchProfileLabels; cache?: CacheAdapter }) {
    this.fetchProfileLabels = deps?.fetchProfileLabels ?? defaultFetchProfileLabels
    this.cache = deps?.cache ?? getCacheAdapter('generic')
  }

  async getHiddenDids(dids: string[]): Promise<Set<string>> {
    const unique = [...new Set(dids)]
    const hidden = new Set<string>()
    const uncached: string[] = []

    await Promise.all(
      unique.map(async did => {
        // Wrapped: RedisCacheAdapter treats a bare `false` as a miss
        const cached = await this.cache.get<{ hidden: boolean }>(CACHE_KEY(did))
        if (!cached) uncached.push(did)
        else if (cached.hidden) hidden.add(did)
      }),
    )

    for (let i = 0; i < uncached.length; i += PROFILES_BATCH_SIZE) {
      const batch = uncached.slice(i, i + PROFILES_BATCH_SIZE)
      let profiles: Awaited<ReturnType<FetchProfileLabels>>
      try {
        profiles = await this.fetchProfileLabels(batch)
      } catch (error) {
        console.warn('[moderation] Failed to fetch account labels', error)
        continue
      }
      const labelsByDid = new Map(profiles.map(profile => [profile.did, profile.labels]))
      await Promise.all(
        batch.map(async did => {
          // An account missing from the AppView isn't evidence of anything; don't hide it.
          const isHidden = isHiddenByLabels(labelsByDid.get(did))
          if (isHidden) hidden.add(did)
          await this.cache.set(CACHE_KEY(did), { hidden: isHidden }, CACHE_MAX_AGE_ONE_HOUR)
        }),
      )
    }

    return hidden
  }

  async isHidden(did: string): Promise<boolean> {
    return (await this.getHiddenDids([did])).has(did)
  }
}
