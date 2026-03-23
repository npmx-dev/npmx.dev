import type { AtprotoProfile } from '#shared/types/atproto'
import { Client, type AtIdentifierString } from '@atproto/lex'
import * as app from '#shared/types/lexicons/app'
import { BLUESKY_API, ERROR_PDS_FETCH_FAILED } from '#shared/utils/constants'

const NPMX_PDS_HOST = 'https://npmx.social'
const LIST_REPOS_LIMIT = 1000
const USER_BATCH_AMOUNT = 25

const blueskyClient = new Client({ service: BLUESKY_API })

/**
 * Paginate through all repos on the npmx PDS via com.atproto.sync.listRepos.
 * The lexicon type isn't generated in this codebase, so we use raw fetch
 * with cursor-based pagination to handle >1k accounts.
 */
async function fetchAllDids(): Promise<string[]> {
  const dids: string[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${NPMX_PDS_HOST}/xrpc/com.atproto.sync.listRepos`)
    url.searchParams.set('limit', String(LIST_REPOS_LIMIT))
    if (cursor) url.searchParams.set('cursor', cursor)

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: ERROR_PDS_FETCH_FAILED,
      })
    }

    const data = (await response.json()) as {
      repos: { did: string }[]
      cursor?: string
    }

    dids.push(...data.repos.map(repo => repo.did))
    cursor = data.cursor
  } while (cursor)

  return dids
}

export default defineCachedEventHandler(
  async (): Promise<AtprotoProfile[]> => {
    const dids = await fetchAllDids()

    // Fetch profiles in batches of 25 (API limit) using the @atproto/lex client
    const batchPromises: Promise<AtprotoProfile[]>[] = []

    for (let i = 0; i < dids.length; i += USER_BATCH_AMOUNT) {
      const batch = dids.slice(i, i + USER_BATCH_AMOUNT)

      batchPromises.push(
        blueskyClient
          .call(
            app.bsky.actor.getProfiles,
            { actors: batch as AtIdentifierString[] },
            { validateResponse: false },
          )
          .then(data =>
            data.profiles.map(profile => ({
              did: profile.did,
              handle: profile.handle,
              displayName: profile.displayName,
              avatar: profile.avatar,
            })),
          )
          .catch(err => {
            console.warn('Failed to fetch batch:', err)
            return []
          }),
      )
    }

    return (await Promise.all(batchPromises)).flat()
  },
  {
    maxAge: 3600,
    name: 'pds-users',
    getKey: () => 'pds-users',
  },
)
