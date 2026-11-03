import * as v from 'valibot'

/**
 * A single account returned by the atproto typeahead search.
 * Mirrors the subset of `app.bsky.actor.defs#profileViewBasic` we render.
 */
export const ActorSearchResultSchema = v.object({
  did: v.string(),
  handle: v.string(),
  displayName: v.optional(v.string()),
  avatar: v.optional(v.string()),
})

export const ActorSearchResponseSchema = v.object({
  actors: v.array(ActorSearchResultSchema),
})

export type ActorSearchResult = v.InferOutput<typeof ActorSearchResultSchema>
export type ActorSearchResponse = v.InferOutput<typeof ActorSearchResponseSchema>
