import { boolean, object, optional, pipe, string, url } from 'valibot'
import type { InferOutput } from 'valibot'

/**
 * INFO: Validates AT Protocol createSession response
 * Used for authenticating PDS sessions.
 */
export const PDSSessionSchema = object({
  did: string(),
  handle: string(),
  accessJwt: string(),
  refreshJwt: string(),
  email: string(),
  emailConfirmed: boolean(),
})

export type PDSSessionResponse = InferOutput<typeof PDSSessionSchema>

export const BlogMetaRequestSchema = object({
  url: pipe(string(), url()),
})

export type BlogMetaRequest = InferOutput<typeof BlogMetaRequestSchema>

export const BlogMetaResponseSchema = object({
  title: string(),
  author: optional(string()),
  description: optional(string()),
  image: optional(string()),
  _meta: optional(object({})),
})

export type BlogMetaResponse = InferOutput<typeof BlogMetaResponseSchema>
