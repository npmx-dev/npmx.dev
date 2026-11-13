import type { H3Event } from 'h3'
import { getQuery, getRouterParam } from 'h3'
import { isTidString } from '@atproto/lex'

export function getPaginationQuery(event: H3Event, defaultLimit = 20, maxLimit = 100) {
  const query = getQuery(event)
  const cursor = typeof query.cursor === 'string' && query.cursor ? query.cursor : undefined
  const parsedLimit = typeof query.limit === 'string' ? Number(query.limit) : NaN
  const limit = Number.isNaN(parsedLimit)
    ? defaultLimit
    : Math.min(Math.max(Math.trunc(parsedLimit), 1), maxLimit)
  return { cursor, limit }
}

/** The `identifier` and `rkey` params of `[identifier]/[rkey]` routes. */
export function getCollectionRouteParams(event: H3Event) {
  // The router guarantees both; getMiniDoc validates the identifier.
  const identifier = getRouterParam(event, 'identifier')!
  const rkey = getRouterParam(event, 'rkey')!
  // We only ever create TID keys; anything else isn't one of ours to serve.
  if (!isTidString(rkey)) throw createError({ status: 400, message: 'Invalid collection key' })
  return { identifier, rkey }
}
