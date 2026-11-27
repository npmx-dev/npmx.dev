/**
 * Public, cacheable like counts for a npm package on npmx
 */
export type PublicPackageLikes = {
  totalLikes: number
  topLikedRank: number | null
}

/**
 * Per-user like status for a npm package on npmx
 */
export type PackageLikeStatus = {
  userHasLiked: boolean
  totalLikes?: number
}

/**
 * Likes for a npm package on npmx
 */
export type PackageLikes = PublicPackageLikes & {
  userHasLiked: boolean
}

/**
 * Approximate number of social posts mentioning a npm package
 */
export type PackageSocialMentions = {
  // Exact unique mention count up to 99, or 99 when capped
  totalMentions: number
  // True when there are more than 99 unique mentions
  isCapped: boolean
}

export type LikesLeaderboardEntry = {
  rank: number
  packageName: string
  subjectRef: string
  totalLikes: number
  packageDescription: string | null
  weeklyDownloads: number | null
  repositoryStars: number | null
  homepagePreviewUrl: string | null
  homepagePreviewWidth: number | null
  homepagePreviewHeight: number | null
  homepageLogoUrl: string | null
  homepageLogoWidth: number | null
  homepageLogoHeight: number | null
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
  // If the atproto record exists for the profile
  recordExists: boolean
  handle?: string
}
