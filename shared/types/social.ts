/**
 * Likes for a npm package on npmx
 */
export type PackageLikes = {
  // The total likes found for the package
  totalLikes: number
  // If the logged in user has liked the package, false if not logged in
  userHasLiked: boolean
}
