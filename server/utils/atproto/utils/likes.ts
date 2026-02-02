import { getCacheAdatper } from '../../cache'
import { $nsid as likeNsid } from '#shared/types/lexicons/dev/npmx/feed/like.defs'

/**
 * Likes for a npm package on npmx
 */
export type PackageLikes = {
  // The total likes found for the package
  totalLikes: number
  // If the logged in user has liked the package, false if not logged in
  userHasLiked: boolean
}

const CACHE_PREFIX = 'atproto-likes:'
const CACHE_PACKAGE_TOTAL_KEY = (packageName: string) => `${CACHE_PREFIX}:${packageName}:total`
const CACHE_USER_LIKES_KEY = (packageName: string, did: string) =>
  `${CACHE_PREFIX}${packageName}:users:${did}`

const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_MINUTE * 5

export class PackageLikesUtils {
  private readonly constellation: Constellation
  private readonly cache: CacheAdapter

  constructor(cachedFunction: CachedFetchFunction) {
    this.constellation = new Constellation(cachedFunction)
    this.cache = getCacheAdatper(CACHE_PREFIX)
  }

  /**
   * Gets the true total count of likes for a npm package from the network
   * @param subjectRef
   * @returns
   */
  private async constellationLikes(subjectRef: string) {
    // TODO: I need to see what failed fetch calls do here
    const { data: totalLinks } = await this.constellation.getLinksDistinctDids(
      subjectRef,
      likeNsid,
      '.subjectRef',
      //Limit doesn't matter here since we are just counting the total likes
      1,
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
    )
    //TODO: need to double check this logic
    return userLikes.total > 0
  }

  /**
   * Gets the likes for a npm package on npmx. Tries a local cahce first, if not found uses constellation
   * @param packageName
   * @param usersDid
   * @returns
   */
  async getLikes(packageName: string, usersDid?: string | undefined) {
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
        await this.cache.set(CACHE_USER_LIKES_KEY(packageName, usersDid), true, CACHE_MAX_AGE)
      }
    }

    const packageLikes = {
      totalPackageLikes: totalLikes,
      userHasLiked,
    }

    return packageLikes
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
   */
  async likeAPackageAndRetunLikes(packageName: string, usersDid: string): Promise<PackageLikes> {
    const totalLikesKey = CACHE_PACKAGE_TOTAL_KEY(packageName)
    let totalLikes = await this.cache.get<number>(totalLikesKey)
    // If a cahce entry was found for total likes increase by 1
    if (totalLikes !== undefined) {
      await this.cache.set(totalLikesKey, totalLikes + 1, CACHE_MAX_AGE)
    } else {
      const subjectRef = PACKAGE_SUBJECT_REF(packageName)
      totalLikes = await this.constellationLikes(subjectRef)
    }
    // We already know the user has not liked the package so set in the cache
    await this.cache.set(CACHE_USER_LIKES_KEY(packageName, usersDid), true, CACHE_MAX_AGE)
    return {
      totalLikes: totalLikes,
      userHasLiked: true,
    }
  }
}
