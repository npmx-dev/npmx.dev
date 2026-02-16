// This is for getting the session on the npmx server and differs from the OAuthSession
import type { H3Event } from 'h3'
import type { UserServerSession } from '#shared/types/userSession'

/**
 * Get's the user's session that is stored on the server
 * @param event
 * @returns
 */
export const useServerSession = async (event: H3Event) => {
  const config = useRuntimeConfig(event)

  if (!config.sessionPassword) {
    throw new Error('Session password is not configured')
  }

  const serverSession = await useSession<UserServerSession>(event, {
    password: config.sessionPassword,
    maxAge: CACHE_MAX_AGE_ONE_DAY * 179,
  })

  return serverSession
}
