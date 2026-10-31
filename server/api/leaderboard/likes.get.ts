import { defineEventHandler } from 'nuxt/server'
import type { LikesLeaderboardEntry } from '#shared/types/social'
import { enrichLikesLeaderboardEntries, getLikesLeaderboard } from '#server/utils/likes-leaderboard'

export default defineEventHandler(async (event): Promise<LikesLeaderboardEntry[]> => {
  const leaderboardEntries = await getLikesLeaderboard(event)
  if (!leaderboardEntries) return []

  return await enrichLikesLeaderboardEntries(event, leaderboardEntries)
})
