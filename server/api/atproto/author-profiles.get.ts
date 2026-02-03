import * as v from 'valibot'
import { CACHE_MAX_AGE_ONE_DAY, BLUESKY_API } from '#shared/utils/constants'
import { AuthorSchema } from '#shared/schemas/blog'
import type { Author, ResolvedAuthor } from '#shared/schemas/blog'

type ProfilesResponse = {
  profiles: Array<{
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }>
}

export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)
    const authorsParam = query.authors

    if (!authorsParam || typeof authorsParam !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'authors query parameter is required (JSON array)',
      })
    }

    let authors: Author[]
    try {
      const parsed = JSON.parse(authorsParam)
      authors = v.parse(v.array(AuthorSchema), parsed)
    } catch (error) {
      if (error instanceof v.ValiError) {
        throw createError({
          statusCode: 400,
          statusMessage: `Invalid authors format: ${error.message}`,
        })
      }
      throw createError({
        statusCode: 400,
        statusMessage: 'authors must be valid JSON',
      })
    }

    if (!Array.isArray(authors) || authors.length === 0) {
      return { authors: [] }
    }

    const handles = authors.filter(a => a.blueskyHandle).map(a => a.blueskyHandle as string)

    if (handles.length === 0) {
      return {
        authors: authors.map(author => ({
          ...author,
          avatar: null,
          profileUrl: null,
        })),
      }
    }

    const response = await $fetch<ProfilesResponse>(`${BLUESKY_API}app.bsky.actor.getProfiles`, {
      query: { actors: handles },
    }).catch(() => ({ profiles: [] }))

    const avatarMap = new Map<string, string>()
    for (const profile of response.profiles) {
      if (profile.avatar) {
        avatarMap.set(profile.handle, profile.avatar)
      }
    }

    const resolvedAuthors: ResolvedAuthor[] = authors.map(author => ({
      ...author,
      avatar: author.blueskyHandle ? avatarMap.get(author.blueskyHandle) || null : null,
      profileUrl: author.blueskyHandle ? `https://bsky.app/profile/${author.blueskyHandle}` : null,
    }))

    return { authors: resolvedAuthors }
  },
  {
    name: 'author-profiles',
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    getKey: event => {
      const { authors } = getQuery(event)
      return `author-profiles:${authors}`
    },
  },
)
