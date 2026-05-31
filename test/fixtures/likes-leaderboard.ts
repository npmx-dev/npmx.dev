import type { LikesLeaderboardEntry } from '#shared/types/social'

export function createLikesLeaderboardEntry(
  packageName: string,
  overrides: Partial<LikesLeaderboardEntry> = {},
): LikesLeaderboardEntry {
  return {
    rank: 1,
    packageName,
    subjectRef: `https://npmx.dev/package/${packageName}`,
    totalLikes: 0,
    packageDescription: null,
    weeklyDownloads: null,
    repositoryStars: null,
    homepagePreviewUrl: null,
    homepagePreviewWidth: null,
    homepagePreviewHeight: null,
    homepageLogoUrl: null,
    homepageLogoWidth: null,
    homepageLogoHeight: null,
    ...overrides,
  }
}
