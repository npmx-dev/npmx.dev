import {
  boolean,
  minLength,
  nonEmpty,
  object,
  optional,
  picklist,
  pipe,
  regex,
  startsWith,
  string,
} from 'valibot'
import type { InferOutput } from 'valibot'
import { AT_URI_REGEX, BLUESKY_URL_REGEX, ERROR_BLUESKY_URL_FAILED } from '#shared/utils/constants'

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

/**
 * INFO: Validates AT Protocol URI format (at://did:plc:.../app.bsky.feed.post/...)
 * Used for referencing Bluesky posts in our database and API routes.
 */
export const BlueSkyUriSchema = object({
  uri: pipe(
    string(),
    startsWith('at://'),
    minLength(10),
    regex(AT_URI_REGEX, 'Must be a valid at:// URI'),
  ),
})

export type BlueSkyUri = InferOutput<typeof BlueSkyUriSchema>

/**
 * INFO: Validates query parameters for Bluesky oEmbed generation.
 * - url: Must be a valid bsky.app profile post URL
 * - colorMode: Optional theme preference (defaults to 'system')
 */
export const BlueskyOEmbedRequestSchema = object({
  url: pipe(string(), nonEmpty(), regex(BLUESKY_URL_REGEX, ERROR_BLUESKY_URL_FAILED)),
  colorMode: optional(picklist(['system', 'dark', 'light']), 'system'),
})

export type BlueskyOEmbedRequest = InferOutput<typeof BlueskyOEmbedRequestSchema>

/**
 * INFO: Explicit type generation for the response.
 */
export const BlueskyOEmbedResponseSchema = object({
  embedUrl: string(),
  did: string(),
  postId: string(),
  handle: string(),
})

export type BlueskyOEmbedResponse = InferOutput<typeof BlueskyOEmbedResponseSchema>
