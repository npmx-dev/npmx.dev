import type { Comment } from '#shared/types/blog-post'
import { BLUESKY_COMMENTS_REQUEST } from '#shared/utils/constants'

/**
 * @public
 */
export type BlueskyCommentsState = {
  thread: Comment | null
  likes: Array<{
    actor: {
      did: string
      handle: string
      displayName?: string
      avatar?: string
    }
  }>
  totalLikes: number
  postUrl: string | null
  _empty?: boolean
  _error?: boolean
}

// Handles both server-side caching and client-side hydration
/**
 * @public
 */
export function useBlueskyComments(postUri: MaybeRefOrGetter<string>) {
  const uri = toRef(postUri)

  const { data, pending, error, refresh } = useFetch(BLUESKY_COMMENTS_REQUEST, {
    query: { uri },
    key: () => `bsky-comments-${uri.value}`,
    default: (): BlueskyCommentsState => ({
      thread: null,
      likes: [],
      totalLikes: 0,
      postUrl: null,
    }),
  })

  // Hydrate with fresh data on client side
  onMounted(() => {
    refresh()
  })

  return {
    data,
    pending,
    error,
    refresh,
  }
}
