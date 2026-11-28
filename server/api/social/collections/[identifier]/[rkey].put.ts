import * as v from 'valibot'
import { CollectionUpdateBodySchema } from '#shared/schemas/social'

/**
 * PUT /api/social/collections/:identifier/:rkey
 *
 * Replaces a collection owned by the logged-in user. Fails with 409 if it changed since `cid`.
 */
export default eventHandlerWithOAuthSession(async (event, session) =>
  updateCollection(
    session,
    getCollectionRouteParams(event),
    v.parse(CollectionUpdateBodySchema, await readBody(event)),
  ),
)
