import type { Backlink } from '#shared/utils/constellation'

const CACHE_PREFIX = 'atproto-social-mentions:'
const CACHE_PACKAGE_TOTAL_KEY = (packageName: string) => `${CACHE_PREFIX}${packageName}:total`

const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_HOUR

const BLUESKY_POST_COLLECTION = 'app.bsky.feed.post'
// getBackLinks expects paths without the leading dot that /links/all returns.
const BLUESKY_LINK_PATHS = [
  'embed.external.uri',
  'facets[].features[app.bsky.richtext.facet#link].uri',
] as const

const NPMJS_PACKAGE_URL = (packageName: string) => `https://www.npmjs.com/package/${packageName}`

/** The subset of Constellation that PackageSocialMentionsUtils actually needs. */
export type ConstellationMentions = Pick<Constellation, 'getBackLinks'>

/**
 * Counts unique Bluesky posts that link to an npm package.
 *
 * Both npmx.dev and npmjs.com package URLs are counted because most posts link
 * to the npmjs.com page, which is usually the larger number. Posts that link
 * multiple URLs, or both embed and facet-link one, are only counted once.
 */
export class PackageSocialMentionsUtils {
  private readonly constellation: ConstellationMentions
  private readonly cache: CacheAdapter

  constructor(deps?: { constellation?: ConstellationMentions; cache?: CacheAdapter }) {
    this.constellation =
      deps?.constellation ??
      new Constellation(
        // Passes in a fetch wrapped as CachedFetch because we're already caching here
        async <T = unknown>(
          url: string,
          options: Parameters<typeof $fetch>[1] = {},
          _ttl?: number,
        ): Promise<CachedFetchResult<T>> => {
          const data = (await $fetch<T>(url, options)) as T
          return { data, isStale: false, cachedAt: null }
        },
      )
    this.cache = deps?.cache ?? getCacheAdapter('generic')
  }

  private async constellationPostKeys(target: string, recordPath: string) {
    const postKeys = new Set<string>()
    let cursor: string | undefined

    do {
      const { data } = await this.constellation.getBackLinks(
        target,
        BLUESKY_POST_COLLECTION,
        recordPath,
        100,
        cursor,
        false,
        [],
        0,
      )

      for (const record of data.records) {
        postKeys.add(postKey(record))
      }
      cursor = data.cursor
    } while (cursor)

    return postKeys
  }

  async getMentions(packageName: string): Promise<PackageSocialMentions> {
    const cacheKey = CACHE_PACKAGE_TOTAL_KEY(packageName)
    const cached = await this.cache.get<PackageSocialMentions>(cacheKey)
    if (cached) return cached

    const targets = [PACKAGE_SUBJECT_REF(packageName), NPMJS_PACKAGE_URL(packageName)]
    const postKeySets = await Promise.all(
      targets.flatMap(target =>
        BLUESKY_LINK_PATHS.map(recordPath => this.constellationPostKeys(target, recordPath)),
      ),
    )

    const uniquePosts = new Set<string>()
    for (const postKeys of postKeySets) {
      for (const key of postKeys) uniquePosts.add(key)
    }

    const result: PackageSocialMentions = {
      totalMentions: uniquePosts.size,
    }
    await this.cache.set(cacheKey, result, CACHE_MAX_AGE)
    return result
  }
}

function postKey(record: Backlink): string {
  return `${record.did}:${record.collection}:${record.rkey}`
}
