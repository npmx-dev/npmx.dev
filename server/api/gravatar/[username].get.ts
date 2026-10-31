import { createError } from 'nuxt/server'
import * as v from 'valibot'
import { GravatarQuerySchema } from '#shared/schemas/user'
import { getGravatarFromUsername } from '#server/utils/gravatar'
import { handleApiError } from '#server/utils/error-handler'
import { getRouterParam } from 'nuxt/server'
import { defineCachedEventHandler } from '#server/utils/cached-handler'

export default defineCachedEventHandler(
  async event => {
    const rawUsername = getRouterParam(event, 'username')

    try {
      const { username } = v.parse(GravatarQuerySchema, {
        username: rawUsername,
      })

      const hash = await getGravatarFromUsername(username)

      if (!hash) {
        throw createError({
          status: 404,
          message: ERROR_GRAVATAR_EMAIL_UNAVAILABLE,
        })
      }

      return { hash }
    } catch (error: unknown) {
      handleApiError(error, {
        status: 502,
        message: ERROR_GRAVATAR_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    getKey: event => {
      const username = getRouterParam(event, 'username')?.trim().toLowerCase()
      return `gravatar:v1:${username}`
    },
  },
)
