import * as v from 'valibot'
import { CollectionItemsChangeSchema } from '#shared/schemas/social'

/**
 * POST /api/social/collections/:identifier/:rkey/items
 *
 * Adds and removes items in a collection owned by the logged-in user.
 */
export default eventHandlerWithOAuthSession(async (event, session) =>
  changeCollectionItems(
    session,
    getCollectionRouteParams(event),
    v.parse(CollectionItemsChangeSchema, await readBody(event)),
  ),
)
