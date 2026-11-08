/**
 * Likes for a npm package on npmx
 */
export type PackageLikes = {
  // The total likes found for the package
  totalLikes: number
  // If the logged in user has liked the package, false if not logged in
  userHasLiked: boolean
  // Top-likes leaderboard rank if the package is in the top 10
  topLikedRank: number | null
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

/** A collection as listed (profile, browse), without resolved items */
export type CollectionSummary = {
  uri: string
  cid: string
  did: string
  handle: string
  rkey: string
  name: string
  description?: string
  itemCount: number
  createdAt: string
}

/** Why an included collection could not be shown */
export type CollectionUnavailableReason = 'unresolvable'

export type CollectionItemView =
  | {
      kind: 'package'
      subjectRef: string
      note?: string
      packageName: string
      // False when the package doesn't exist on the registry (typo, unpublished, spam)
      resolved: boolean
    }
  | {
      kind: 'collection'
      subjectRef: string
      note?: string
      // A summary, not expanded: readers follow the link to see what's in it
      collection: CollectionSummary | null
      unavailableReason?: CollectionUnavailableReason
    }
  | {
      // subjectRef we don't understand; records are untrusted
      kind: 'unknown'
      subjectRef: string
      note?: string
    }

/** One of the viewer's own collections, with what's in it. */
export type OwnCollection = CollectionSummary & { subjectRefs: string[] }

/** Likes or follows of a collection, counted once per account. */
export type ReactionState = {
  total: number
  // False when not logged in. For follows, only about follow records: owners follow their own
  // collections implicitly.
  viewerHas: boolean
}

export type CollectionView = CollectionSummary & {
  items: CollectionItemView[]
  likes: ReactionState
  follows: ReactionState
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
