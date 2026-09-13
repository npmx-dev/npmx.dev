import type { RecentPackageLike } from '~/utils/recent-package-likes'
import { useWebSocket } from '@vueuse/core'
import * as v from 'valibot'
import { encodePackageName } from '#shared/utils/npm'
import {
  RECENT_PACKAGE_LIKES_LIMIT,
  createPackageLikesSeedUrl,
  createPackageLikesStreamUrl,
  parseSpacedustPackageLikeEvent,
  parseUfosPackageLikeRecords,
} from '~/utils/recent-package-likes'

const PackageMetaResponseSchema = v.object({
  description: v.optional(v.string()),
  weeklyDownloads: v.optional(v.nullable(v.number())),
  repositoryStars: v.optional(v.nullable(v.number())),
})

const INITIAL_PACKAGE_LIKE_STAGGER_MS = 480

type RecentPackageLikeMetadata = Pick<
  RecentPackageLike,
  'packageDescription' | 'weeklyDownloads' | 'repositoryStars'
>

export function useRecentPackageLikes(limit: number = RECENT_PACKAGE_LIKES_LIMIT) {
  const likes = shallowRef<RecentPackageLike[]>([])
  const isLoadingInitialLikes = shallowRef(true)
  const metadataByPackageName = new Map<string, RecentPackageLikeMetadata>()
  const metadataRequests = new Set<string>()
  const initialLikeTimers = new Set<ReturnType<typeof setTimeout>>()

  function clearInitialLikeTimers() {
    for (const timer of initialLikeTimers) {
      clearTimeout(timer)
    }
    initialLikeTimers.clear()
  }

  function addLikes(newLikes: RecentPackageLike[]) {
    if (newLikes.length === 0) return

    const enrichedLikes = newLikes.map(like => {
      const metadata = metadataByPackageName.get(like.packageName)
      return metadata ? { ...like, ...metadata } : like
    })

    const seen = new Set<string>()
    likes.value = [...enrichedLikes, ...likes.value]
      .filter(like => {
        if (seen.has(like.id)) return false
        seen.add(like.id)
        return true
      })
      .sort((a, b) => b.likedAt - a.likedAt)
      .slice(0, limit)

    for (const like of likes.value) {
      void loadLikeMetadata(like.packageName)
    }
  }

  function addLike(like: RecentPackageLike) {
    addLikes([{ ...like, animateEntry: true }])
  }

  function addInitialLikes(newLikes: RecentPackageLike[]) {
    clearInitialLikeTimers()

    const stagedLikes = [...newLikes]
      .sort((a, b) => b.likedAt - a.likedAt)
      .slice(0, limit)
      .sort((a, b) => a.likedAt - b.likedAt)

    if (stagedLikes.length === 0) {
      isLoadingInitialLikes.value = false
      return
    }

    stagedLikes.forEach((like, index) => {
      const timer = setTimeout(() => {
        initialLikeTimers.delete(timer)
        addLikes([{ ...like, animateEntry: true }])

        if (index === stagedLikes.length - 1) {
          isLoadingInitialLikes.value = false
        }
      }, index * INITIAL_PACKAGE_LIKE_STAGGER_MS)

      initialLikeTimers.add(timer)
    })
  }

  async function loadInitialLikes() {
    try {
      const response = await fetch(createPackageLikesSeedUrl())
      if (!response.ok) {
        isLoadingInitialLikes.value = false
        return
      }

      addInitialLikes(parseUfosPackageLikeRecords(await response.json()))
    } catch (error) {
      // The live Spacedust stream remains useful even if the UFOs seed request fails.
      if (import.meta.dev && !import.meta.test) {
        // oxlint-disable-next-line no-console
        console.warn('[recent-package-likes] Failed to load initial likes:', error)
      }
      isLoadingInitialLikes.value = false
    }
  }

  function applyLikeMetadata(packageName: string, metadata: RecentPackageLikeMetadata) {
    likes.value = likes.value.map(like =>
      like.packageName === packageName
        ? {
            ...like,
            ...metadata,
          }
        : like,
    )
  }

  async function loadLikeMetadata(packageName: string) {
    if (metadataRequests.has(packageName)) return
    metadataRequests.add(packageName)

    const encodedPackageName = encodePackageName(packageName)
    const parsedMeta = await $fetch<unknown>(`/api/registry/package-meta/${encodedPackageName}`, {
      query: { includeRepositoryStars: 'true' },
    })
      .then(payload => v.safeParse(PackageMetaResponseSchema, payload))
      .catch(error => {
        if (import.meta.dev && !import.meta.test) {
          // oxlint-disable-next-line no-console
          console.warn(`[recent-package-likes] Failed to load metadata for ${packageName}:`, error)
        }
        return null
      })

    const output = parsedMeta?.success ? parsedMeta.output : null
    const metadata: RecentPackageLikeMetadata = {
      packageDescription: output?.description || null,
      weeklyDownloads: output?.weeklyDownloads ?? null,
      repositoryStars: output?.repositoryStars ?? null,
    }

    metadataByPackageName.set(packageName, metadata)
    applyLikeMetadata(packageName, metadata)
  }

  function handleMessage(event: MessageEvent) {
    if (typeof event.data !== 'string') return

    let payload: unknown
    try {
      payload = JSON.parse(event.data)
    } catch {
      return
    }

    const like = parseSpacedustPackageLikeEvent(payload)
    if (like?.origin === 'live') addLike(like)
  }

  const { open: openLikesStream } = useWebSocket(createPackageLikesStreamUrl(), {
    autoConnect: false,
    autoReconnect: {
      delay: retried => Math.min(30_000, 1_000 * 2 ** Math.max(0, retried - 1)),
    },
    immediate: false,
    onError: ws => {
      ws.close()
    },
    onMessage: (_ws, event) => {
      handleMessage(event)
    },
  })

  onMounted(() => {
    void loadInitialLikes()
    if (import.meta.client) openLikesStream()
  })
  onScopeDispose(clearInitialLikeTimers)

  return {
    isLoadingInitialLikes: readonly(isLoadingInitialLikes),
    likes: readonly(likes),
  }
}
