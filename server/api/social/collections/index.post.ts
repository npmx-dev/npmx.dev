import * as v from 'valibot'
import { CollectionBodySchema } from '#shared/schemas/social'

/**
 * POST /api/social/collections
 *
 * Creates a collection in the logged-in user's repo.
 */
export default eventHandlerWithOAuthSession(async (event, session) =>
  createCollection(session, v.parse(CollectionBodySchema, await readBody(event))),
)
