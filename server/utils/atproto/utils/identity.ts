import { Client, isAtIdentifierString } from '@atproto/lex'
import * as blue from '#shared/types/lexicons/blue'

const HEADERS = { 'User-Agent': 'npmx' }

// Aggressive cache on identity since that doesn't change a ton
const CACHE_MAX_AGE_IDENTITY = CACHE_MAX_AGE_ONE_HOUR * 6

const CACHE_KEY_IDENTITY = (identity: string) => `identity:${identity}`

export class IdentityUtils {
  private readonly cache: CacheAdapter
  private readonly slingShotClient: Client
  constructor() {
    this.cache = getCacheAdapter('generic')
    this.slingShotClient = new Client(`https://${SLINGSHOT_HOST}`, {
      headers: HEADERS,
    })
  }

  /**
   * Gets the user's mini doc from slingshot
   * @param identifier - A users did or handle
   * @returns
   */
  async getMiniDoc(
    identifier: string,
  ): Promise<blue.microcosm.identity.resolveMiniDoc.$OutputBody> {
    if (!isAtIdentifierString(identifier)) {
      throw createError({ status: 400, message: 'Invalid AT Protocol identifier' })
    }
    const cacheKey = CACHE_KEY_IDENTITY(identifier)
    const cached =
      await this.cache.get<blue.microcosm.identity.resolveMiniDoc.$OutputBody>(cacheKey)
    if (cached) {
      return cached
    }
    const result = await this.slingShotClient.call(blue.microcosm.identity.resolveMiniDoc, {
      identifier,
    })
    await this.cache.set(cacheKey, result, CACHE_MAX_AGE_IDENTITY)
    return result
  }
}
