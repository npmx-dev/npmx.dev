/**
 * Likes for a npm package on npmx
 */
export type PackageLikes = {
  // The total likes found for the package
  totalLikes: number
  // If the logged in user has liked the package, false if not logged in
  userHasLiked: boolean
}

/**
 * A shortened DID Doc for AT Protocol accounts
 * Returned by Slingshot's `/xrpc/blue.microcosm.identity.resolveMiniDoc` endpoint
 */
export type MiniDoc = {
  did: string
  handle: string
  pds: string
  signing_key: string
}

/**
 * NPMX Profile details
 * TODO: avatar
 */
export type NPMXProfile = {
  displayName: string
  website?: string
  description?: string
}
