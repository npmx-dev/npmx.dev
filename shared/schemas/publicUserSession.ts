import { object, string, pipe, url } from 'valibot'
import type { InferOutput } from 'valibot'

export const PublicUserSessionSchema = object({
  // Safe to pass to the frontend
  did: string(),
  handle: string(),
  pds: pipe(string(), url()),
})

export type PublicUserSession = InferOutput<typeof PublicUserSessionSchema>
