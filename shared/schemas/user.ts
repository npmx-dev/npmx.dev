import * as v from 'valibot'

const NPM_USERNAME_RE = /^[a-z0-9]([\w.-]*[a-z0-9])?$/i
const NPM_USERNAME_MAX_LENGTH = 50

/**
 * Schema for npm usernames.
 */
export const NpmUsernameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty('Username is required'),
  v.maxLength(NPM_USERNAME_MAX_LENGTH, 'Username is too long'),
  v.regex(NPM_USERNAME_RE, 'Invalid username format'),
)

/**
 * Schema for Gravatar query inputs.
 */
export const GravatarQuerySchema = v.object({
  username: NpmUsernameSchema,
})

/** @public */
export type NpmUsername = v.InferOutput<typeof NpmUsernameSchema>
/** @public */
export type GravatarQuery = v.InferOutput<typeof GravatarQuerySchema>
