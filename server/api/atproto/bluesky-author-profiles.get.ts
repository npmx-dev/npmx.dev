import * as v from 'valibot'
import crypto from 'node:crypto'
import {
  CACHE_MAX_AGE_ONE_DAY,
  BLUESKY_API,
  BLUESKY_GET_PROFILES_MAX,
} from '#shared/utils/constants'
import { AuthorSchema } from '#shared/schemas/blog'
import { Client } from '@atproto/lex'
import type { Author, ResolvedAuthor } from '#shared/schemas/blog'
import * as app from '#shared/types/lexicons/app'

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

    const handles = [...new Set(authors.map(a => a.blueskyHandle).filter(handle => handle != null))]

    if (handles.length === 0) {
      return {
        authors: authors.map(author => Object.assign(author, { avatar: null, profileUrl: null })),
      }
    }

    // getProfiles rejects the whole request above its actor limit, so fetch in batches
    const client = new Client({ service: BLUESKY_API })
    const batches: Promise<{ profiles: { handle: string; avatar?: string }[] }>[] = []
    for (let i = 0; i < handles.length; i += BLUESKY_GET_PROFILES_MAX) {
      const actors = handles.slice(i, i + BLUESKY_GET_PROFILES_MAX)
      batches.push(
        client.call(app.bsky.actor.getProfiles, { actors }).catch(error => {
          console.warn('[bluesky-author-profiles] Failed to fetch profiles batch:', error)
          return { profiles: [] }
        }),
      )
    }
    const profiles = (await Promise.all(batches)).flatMap(batch => batch.profiles)

    const avatarMap = new Map<string, string>()

    for (const profile of profiles) {
      if (profile.avatar) {
        avatarMap.set(profile.handle, profile.avatar)
      }
    }

    const resolvedAuthors: ResolvedAuthor[] = authors.map(author =>
      Object.assign(author, {
        avatar: author.blueskyHandle ? avatarMap.get(author.blueskyHandle) || null : null,
        profileUrl: author.blueskyHandle
          ? `https://bsky.app/profile/${author.blueskyHandle}`
          : null,
      }),
    )

    return { authors: resolvedAuthors }
  },
  {
    name: 'author-profiles',
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    getKey: event => {
      const { authors } = getQuery(event)
      const hash = crypto
        .createHash('md5')
        .update(JSON.stringify(authors ?? 'npmx.dev'))
        .digest('hex')
      return `author-profiles:${hash}`
    },
  },
)
