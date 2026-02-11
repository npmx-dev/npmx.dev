import * as v from 'valibot'
import type { InferOutput } from 'valibot'

export const PublicUserSessionSchema = v.object({
  // Safe to pass to the frontend
  did: v.string(),
  handle: v.string(),
  pds: v.pipe(v.string(), v.url()),
  avatar: v.optional(v.pipe(v.string(), v.url())),
  relogin: v.optional(v.boolean()),
})

export type PublicUserSession = InferOutput<typeof PublicUserSessionSchema>
