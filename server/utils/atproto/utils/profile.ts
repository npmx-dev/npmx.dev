import type { MiniDoc, NPMXProfile } from '#shared/types/social'
import * as blue from '#shared/types/lexicons/blue'
import * as dev from '#shared/types/lexicons/dev'
import { Client, isAtIdentifierString, isAtUriString } from '@atproto/lex'

//Cache keys and helpers
const CACHE_PREFIX = 'atproto-profile:'
const CACHE_PROFILE_MINI_DOC = (handle: string) => `${CACHE_PREFIX}${handle}:minidoc`
const CACHE_PROFILE_KEY = (did: string) => `${CACHE_PREFIX}${did}:profile`

const CACHE_MAX_AGE = CACHE_MAX_AGE_ONE_MINUTE * 5

/**
 * Logic to handle and update profile queries
 */
export class ProfileUtils {
  private readonly cache: CacheAdapter
  private readonly slingshotClient: Client

  constructor() {
    this.cache = getCacheAdapter('generic')
    this.slingshotClient = new Client({ service: `https://${SLINGSHOT_HOST}` })
  }

  private async slingshotMiniDoc(handle: string) {
    const miniDocKey = CACHE_PROFILE_MINI_DOC(handle)
    const cachedMiniDoc = await this.cache.get<MiniDoc>(miniDocKey)

    let miniDoc
    if (cachedMiniDoc) {
      miniDoc = cachedMiniDoc
    } else {
      if (!isAtIdentifierString(handle)) {
        throw createError({
          status: 400,
          message: `Invalid at-identifier: ${handle}`,
        })
      }

      const response = await this.slingshotClient.xrpcSafe(blue.microcosm.identity.resolveMiniDoc, {
        headers: { 'User-Agent': 'npmx' },
        params: { identifier: handle },
      })
      if (!response.success) {
        // Not always, but usually this will mean the profile cannot be found
        // and can be assumed most of the time it does not exists
        throw createError({
          status: 404,
          message: `Failed to resolve MiniDoc for ${handle}`,
        })
      }

      miniDoc = response.body
      await this.cache.set(miniDocKey, miniDoc, CACHE_MAX_AGE)
    }

    return miniDoc
  }

  /**
   * Gets an npmx profile based on a handle
   * @param handle
   * @returns
   */
  async getProfile(handle: string): Promise<NPMXProfile | undefined> {
    const miniDoc = await this.slingshotMiniDoc(handle)
    const profileKey = CACHE_PROFILE_KEY(miniDoc.did)
    const cachedProfile = await this.cache.get<NPMXProfile>(profileKey)

    let profile: NPMXProfile | undefined
    if (cachedProfile) {
      profile = cachedProfile
    } else {
      const profileUri = `at://${miniDoc.did}/dev.npmx.actor.profile/self`
      if (!isAtUriString(profileUri)) {
        throw new Error(`Invalid at-uri: ${profileUri}`)
      }

      const response = await this.slingshotClient.xrpcSafe(blue.microcosm.repo.getRecordByUri, {
        headers: { 'User-Agent': 'npmx' },
        params: { at_uri: profileUri },
      })

      if (response.success) {
        try {
          const validationResult = dev.npmx.actor.profile.$validate(response.body.value)
          profile = { recordExists: true, handle: miniDoc.handle, ...validationResult }
          await this.cache.set(profileKey, profile, CACHE_MAX_AGE)
        } catch (error) {
          //Most new profiles will error because of a bug of setting the website to a non uri string
          console.error('[profile-get]', error)
          profile = { recordExists: true, handle: miniDoc.handle, displayName: miniDoc.handle }
        }
      } else {
        if (response.error === 'RecordNotFound') {
          return {
            recordExists: false,
            displayName: miniDoc.handle,
            description: '',
            website: '',
            handle: miniDoc.handle,
          }
        }
        throw new Error(`Failed to fetch profile: ${response.error}`)
      }
    }

    return profile
  }

  async updateProfileCache(handle: string, profile: NPMXProfile): Promise<NPMXProfile | undefined> {
    const miniDoc = await this.slingshotMiniDoc(handle)
    const profileKey = CACHE_PROFILE_KEY(miniDoc.did)
    profile.handle = miniDoc.handle
    await this.cache.set(profileKey, profile, CACHE_MAX_AGE)
    return profile
  }
}
