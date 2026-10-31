// This is for getting the session on the npmx server and differs from the OAuthSession
import type { RequestEvent, SessionData } from 'nuxt/server'
import type { UserServerSession } from '#shared/types/userSession'
import { useRuntimeConfig, useSession } from 'nuxt/server'

/**
 * Get's the user's session that is stored on the server
 * @param event
 * @returns
 */
export const useServerSession = async (event: RequestEvent) => {
  const config = useRuntimeConfig()

  if (!config.sessionPassword) {
    throw new Error('Session password is not configured')
  }

  const serverSession = await useSession<UserServerSession & SessionData>(event, {
    password: config.sessionPassword,
    maxAge: CACHE_MAX_AGE_ONE_DAY * 179,
  })

  return serverSession
}
