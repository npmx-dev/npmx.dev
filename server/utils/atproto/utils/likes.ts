import { $nsid as likeNsid } from '#shared/types/lexicons/dev/npmx/feed/like.defs'
import type { Backlink } from '#shared/utils/constellation'
import { TID } from '@atproto/common'

//Cache keys and helpers
const CACHE_PREFIX = 'atproto-likes:'
const CACHE_PACKAGE_TOTAL_KEY = (packageName: string) => `${CACHE_PREFIX}${packageName}:total`
const CACHE_USER_LIKES_KEY = (packageName: string, did: string) =>
  `${CACHE_PREFIX}${packageName}:users:${did}:liked`
const CACHE_USERS_BACK_LINK = (packageName: string, did: string) =>
  `${CACHE_PREFIX}${packageName}:users:${did}:backlink`
const CACHE_EVOLUTION_KEY = (packageName: string) => `${CACHE_PREFIX}${packageName}:evolution`

const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_MINUTE * 5

/**
 * Decodes TID timestamps from backlink rkeys and groups by day.
 * Pure function — no I/O, no side effects.
 */
export function aggregateBacklinksByDay(
  backlinks: Backlink[],
): Array<{ day: string; likes: number }> {
  const countsByDay = new Map<string, number>()
  for (const backlink of backlinks) {
    try {
      const tid = TID.fromStr(backlink.rkey)
      const timestampMs = tid.timestamp() / 1000
      const date = new Date(timestampMs)
      const day = date.toISOString().slice(0, 10)
      countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1)
    } catch {
      console.warn(`Skipping non-TID rkey: ${backlink.rkey}`)
    }
  }
  return Array.from(countsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, likes]) => ({ day, likes }))
}

/** The subset of Constellation that PackageLikesUtils actually needs. */
export type ConstellationLike = Pick<Constellation, 'getBackLinks' | 'getLinksDistinctDids'>

/**
 * Logic to handle liking, unliking, and seeing if a user has liked a package on npmx
 */
export class PackageLikesUtils {
  private readonly constellation: ConstellationLike
  private readonly cache: CacheAdapter

  constructor(deps?: { constellation?: ConstellationLike; cache?: CacheAdapter }) {
    this.constellation =
      deps?.constellation ??
      new Constellation(
        // Passes in a fetch wrapped as cachedfetch since are already doing some heavy caching here
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

  /**
   * Gets the true total count of likes for a npm package from the network
   * @param subjectRef
   * @returns
   */
  private async constellationLikes(subjectRef: string) {
    const { data: totalLinks } = await this.constellation.getLinksDistinctDids(
      subjectRef,
      likeNsid,
      '.subjectRef',
      //Limit doesn't matter here since we are just counting the total likes
      1,
      undefined,
      0,
    )
    return totalLinks.total
  }

  /**
   * Checks if the user has liked the npm package from the network
   * @param subjectRef
   * @param usersDid
   * @returns
   */
  private async constellationUserHasLiked(subjectRef: string, usersDid: string) {
    const { data: userLikes } = await this.constellation.getBackLinks(
      subjectRef,
      likeNsid,
      'subjectRef',
      //Limit doesn't matter here since we are just counting the total likes
      1,
      undefined,
      false,
      [[usersDid]],
      0,
    )
    return userLikes.total > 0
  }

  /**
   * Gets the likes for a npm package on npmx. Tries a local cahce first, if not found uses constellation
   * @param packageName
   * @param usersDid
   * @returns
   */
  async getLikes(packageName: string, usersDid?: string | undefined): Promise<PackageLikes> {
    //TODO: May need to do some clean up on the package name, and maybe even hash it? some of the charcteres may be a bit odd as keys
    const totalLikesKey = CACHE_PACKAGE_TOTAL_KEY(packageName)
    const subjectRef = PACKAGE_SUBJECT_REF(packageName)

    const cachedLikes = await this.cache.get<number>(totalLikesKey)
    let totalLikes = 0
    if (cachedLikes) {
      totalLikes = cachedLikes
    } else {
      totalLikes = await this.constellationLikes(subjectRef)
      await this.cache.set(totalLikesKey, totalLikes, CACHE_MAX_AGE)
    }

    let userHasLiked = false
    if (usersDid) {
      const userCachedLike = await this.cache.get<boolean>(
        CACHE_USER_LIKES_KEY(packageName, usersDid),
      )
      if (userCachedLike) {
        userHasLiked = userCachedLike
      } else {
        userHasLiked = await this.constellationUserHasLiked(subjectRef, usersDid)
        await this.cache.set(
          CACHE_USER_LIKES_KEY(packageName, usersDid),
          userHasLiked,
          CACHE_MAX_AGE,
        )
      }
    }

    return {
      totalLikes: totalLikes,
      userHasLiked,
    }
  }

  /**
   * Gets the definite answer if the user has liked a npm package. Either from the cache or the network
   * @param packageName
   * @param usersDid
   * @returns
   */
  async hasTheUserLikedThePackage(packageName: string, usersDid: string) {
    const cached = await this.cache.get<boolean>(CACHE_USER_LIKES_KEY(packageName, usersDid))
    if (cached !== undefined) {
      return cached
    }
    const subjectRef = PACKAGE_SUBJECT_REF(packageName)

    const userHasLiked = await this.constellationUserHasLiked(subjectRef, usersDid)
    await this.cache.set(CACHE_USER_LIKES_KEY(packageName, usersDid), userHasLiked, CACHE_MAX_AGE)
    return userHasLiked
  }

  /**
   * It is asummed it has been checked by this point that if a user has liked a package and the new like was made as a record
   * to the user's atproto repostiory
   * @param packageName
   * @param usersDid
   * @param atUri - The URI of the like record
   */
  async likeAPackageAndReturnLikes(
    packageName: string,
    usersDid: string,
    atUri: string,
  ): Promise<PackageLikes> {
    const totalLikesKey = CACHE_PACKAGE_TOTAL_KEY(packageName)
    const subjectRef = PACKAGE_SUBJECT_REF(packageName)

    const splitAtUri = atUri.replace('at://', '').split('/')
    const collection = splitAtUri[1]
    const rkey = splitAtUri[2]

    if (!collection || !rkey) {
      throw new Error(`Invalid atUri given: ${atUri}`)
    }
    const backLink: Backlink = {
      did: usersDid,
      collection,
      rkey,
    }

    // We store the backlink incase a user is liking and unlikign rapidly. constellation takes a few seconds to capture the backlink
    const usersBackLinkKey = CACHE_USERS_BACK_LINK(packageName, usersDid)
    await this.cache.set(usersBackLinkKey, backLink, CACHE_MAX_AGE)

    let totalLikes = await this.cache.get<number>(totalLikesKey)
    if (!totalLikes) {
      totalLikes = await this.constellationLikes(subjectRef)
    }
    totalLikes = totalLikes + 1
    await this.cache.set(totalLikesKey, totalLikes, CACHE_MAX_AGE)

    // We already know the user has not liked the package before so set in the cache
    await this.cache.set(CACHE_USER_LIKES_KEY(packageName, usersDid), true, CACHE_MAX_AGE)
    return {
      totalLikes: totalLikes,
      userHasLiked: true,
    }
  }

  /**
   * We need to get the record the user has that they liked the package
   * @param packageName
   * @param usersDid
   * @returns
   */
  async getTheUsersLikedRecord(
    packageName: string,
    usersDid: string,
  ): Promise<Backlink | undefined> {
    const usersBackLinkKey = CACHE_USERS_BACK_LINK(packageName, usersDid)
    const backLink = await this.cache.get<Backlink>(usersBackLinkKey)
    if (backLink) {
      return backLink
    }

    const subjectRef = PACKAGE_SUBJECT_REF(packageName)
    const { data: userLikes } = await this.constellation.getBackLinks(
      subjectRef,
      likeNsid,
      'subjectRef',
      //Limit doesn't matter here since we are just counting the total likes
      1,
      undefined,
      false,
      [[usersDid]],
      0,
    )
    if (userLikes.total > 0 && userLikes.records.length > 0) {
      return userLikes.records[0]
    }
  }

  /**
   * Access to unlike a package for a user in the cache.
   * @param packageName
   * @param usersDid
   */
  async setUnlikeInCache(packageName: string, usersDid: string) {
    await this.cache.set(CACHE_USER_LIKES_KEY(packageName, usersDid), false, CACHE_MAX_AGE)
  }

  /**
   * At this point you should have checked if the user had a record for the package on the network and removed it before updating the cache
   * @param packageName
   * @param usersDid
   * @returns
   */
  async unlikeAPackageAndReturnLikes(packageName: string, usersDid: string): Promise<PackageLikes> {
    const totalLikesKey = CACHE_PACKAGE_TOTAL_KEY(packageName)
    const subjectRef = PACKAGE_SUBJECT_REF(packageName)

    let totalLikes = await this.cache.get<number>(totalLikesKey)
    if (!totalLikes) {
      totalLikes = await this.constellationLikes(subjectRef)
    }
    totalLikes = Math.max(totalLikes - 1, 0)
    await this.cache.set(totalLikesKey, totalLikes, CACHE_MAX_AGE)

    //Clean up
    await this.setUnlikeInCache(packageName, usersDid)
    await this.cache.delete(CACHE_USERS_BACK_LINK(packageName, usersDid))

    return {
      totalLikes: totalLikes,
      userHasLiked: false,
    }
  }

  /**
   * Gets the likes evolution for a package as daily {day, likes} points.
   * Fetches ALL backlinks via paginated constellation calls, decodes TID
   * timestamps from each rkey, and groups by day.
   * Results are cached for 5 minutes.
   */
  async getLikesEvolution(packageName: string): Promise<Array<{ day: string; likes: number }>> {
    const cacheKey = CACHE_EVOLUTION_KEY(packageName)
    const cached = await this.cache.get<Array<{ day: string; likes: number }>>(cacheKey)
    if (cached) return cached

    const subjectRef = PACKAGE_SUBJECT_REF(packageName)
    const allBacklinks: Backlink[] = []
    let cursor: string | undefined

    // Paginate through all backlinks
    do {
      const { data } = await this.constellation.getBackLinks(
        subjectRef,
        likeNsid,
        'subjectRef',
        100,
        cursor,
        false,
        [],
        0,
      )
      allBacklinks.push(...data.records)
      cursor = data.cursor
    } while (cursor)

    const result = aggregateBacklinksByDay(allBacklinks)

    await this.cache.set(cacheKey, result, CACHE_MAX_AGE)
    return result
  }
}
