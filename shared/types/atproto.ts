/**
 * The lightweight view of a public profile for an AT Protocol user
 */
export type AtprotoProfile = {
  // The unique Decentralized Identifier (DID)
  did: string
  // User handle (e.g. user.bsky.social or user.com)
  handle: string
  // Display name, if present
  displayName?: string
  // URL of the avatar image, if present
  avatar?: string
}
