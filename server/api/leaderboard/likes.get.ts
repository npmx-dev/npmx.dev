import { eventHandler } from 'h3'
import type { LikesLeaderboardEntry } from '#shared/types/social'
import { getLikesLeaderboard } from '#server/utils/likes-leaderboard'

export default eventHandler(async (event): Promise<LikesLeaderboardEntry[]> => {
  return (await getLikesLeaderboard(event)) ?? []
})
