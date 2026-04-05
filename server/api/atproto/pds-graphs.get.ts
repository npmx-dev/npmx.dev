import { Client, type AtIdentifierString } from '@atproto/lex'
import * as app from '#shared/types/lexicons/app'
import type { AtprotoProfile } from '#shared/types/atproto'

import { BLUESKY_API, ERROR_PDS_FETCH_FAILED } from '#shared/utils/constants'

interface GraphLink {
  source: string
  target: string
}

const NPMX_PDS_HOST = 'https://npmx.social'
const LIST_REPOS_LIMIT = 1000
const USER_BATCH_AMOUNT = 25

const blueskyClient = new Client({ service: BLUESKY_API })

/**
 * Paginate through all repos on the npmx PDS via com.atproto.sync.listRepos.
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
  async (): Promise<{ nodes: AtprotoProfile[]; links: GraphLink[] }> => {
    const dids = await fetchAllDids()
    const localDids = new Set(dids)

    const nodes: AtprotoProfile[] = []
    const links: GraphLink[] = []

    // Fetch profiles in batches using the @atproto/lex client
    for (let i = 0; i < dids.length; i += USER_BATCH_AMOUNT) {
      const batch = dids.slice(i, i + USER_BATCH_AMOUNT)

      try {
        const data = await blueskyClient.call(
          app.bsky.actor.getProfiles,
          {
            actors: batch as AtIdentifierString[],
          },
          { validateResponse: false },
        )

        nodes.push(
          ...data.profiles.map(profile => ({
            did: profile.did,
            handle: profile.handle,
            displayName: profile.displayName,
            avatar: profile.avatar,
          })),
        )
      } catch (error) {
        console.warn('Failed to fetch atproto profiles:', error)
      }
    }

    // Fetch follow graphs (no lexicon type for getFollows, using raw fetch)
    for (const did of dids) {
      try {
        const followResponse = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.graph.getFollows?actor=${did}`,
        )

        if (!followResponse.ok) {
          console.warn(`Failed to fetch follows: ${followResponse.status}`)
          continue
        }

        const followData = (await followResponse.json()) as {
          follows: { did: string }[]
        }

        for (const followedUser of followData.follows) {
          if (localDids.has(followedUser.did)) {
            links.push({ source: did, target: followedUser.did })
          }
        }
      } catch (error) {
        console.warn('Failed to fetch follows:', error)
      }
    }

    return { nodes, links }
  },
  {
    maxAge: 3600,
    name: 'pds-graphs',
    getKey: () => 'pds-graphs',
  },
)
