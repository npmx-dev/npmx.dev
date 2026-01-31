import { object, string, pipe, url } from 'valibot'
import type { InferOutput } from 'valibot'

export const UserSessionSchema = object({
  did: string(),
  handle: string(),
  pds: pipe(string(), url()),
})

export type UserSession = InferOutput<typeof UserSessionSchema>
