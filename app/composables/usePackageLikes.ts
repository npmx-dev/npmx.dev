import type { MaybeRefOrGetter } from 'vue'
import type { PackageLikes, PackageLikeStatus, PublicPackageLikes } from '#shared/types/social'
import { useAtproto } from '~/composables/atproto/useAtproto'
import { useModal } from '~/composables/useModal'
import { togglePackageLike } from '~/utils/atproto/likes'
import { hasSessionHintCookie } from '~/utils/atproto/session-hint'

interface ToggleLikeOptions {
  onOptimisticToggle?: (nextLiked: boolean) => void
}

export function usePackageLikes(packageName: MaybeRefOrGetter<string>) {
  const pkgName = computed(() => toValue(packageName))
  const { user } = useAtproto()
  const authModal = useModal('auth-modal')

  const { data: publicLikes, status: publicStatus } = useFetch<PublicPackageLikes>(
    () => `/api/social/likes/${pkgName.value}`,
    {
      default: () => ({
        totalLikes: 0,
        topLikedRank: null,
      }),
      server: false,
    },
  )

  const canFetchUserStatus = () =>
    import.meta.client && (Boolean(user.value) || hasSessionHintCookie())

  const {
    data: userLikeData,
    status: userLikeStatus,
    execute: executeUserLikeStatus,
    clear: clearUserLikeStatus,
  } = useFetch<PackageLikeStatus>(() => `/api/social/like-status/${pkgName.value}`, {
    server: false,
    enabled: canFetchUserStatus,
    immediate: canFetchUserStatus(),
    watch: false,
  })

  const localMutation = shallowRef<{ totalLikes: number; userHasLiked: boolean } | null>(null)
  const isLikeActionPending = shallowRef(false)

  watch(pkgName, () => {
    localMutation.value = null
    isLikeActionPending.value = false
    clearUserLikeStatus()
    if (canFetchUserStatus()) {
      void executeUserLikeStatus()
    }
  })

  watch(
    () => user.value?.did ?? null,
    (did, prevDid) => {
      if (did === prevDid) return
      localMutation.value = null
      isLikeActionPending.value = false
      if (did) {
        if (userLikeStatus.value === 'idle' || prevDid !== null) {
          void executeUserLikeStatus()
        }
      } else {
        clearUserLikeStatus()
      }
    },
  )

  const isLoading = computed(
    () =>
      publicStatus.value === 'pending' ||
      publicStatus.value === 'idle' ||
      userLikeStatus.value === 'pending',
  )

  const likesData = computed<PackageLikes>(() => {
    const topLikedRank = publicLikes.value?.topLikedRank ?? null
    if (localMutation.value) {
      return {
        totalLikes: localMutation.value.totalLikes,
        userHasLiked: localMutation.value.userHasLiked,
        topLikedRank,
      }
    }

    return {
      totalLikes: userLikeData.value?.totalLikes ?? publicLikes.value?.totalLikes ?? 0,
      userHasLiked: userLikeData.value?.userHasLiked ?? false,
      topLikedRank,
    }
  })

  const toggleLike = async (options?: ToggleLikeOptions) => {
    if (user.value?.handle == null) {
      authModal.open()
      return
    }

    if (isLikeActionPending.value || isLoading.value) return

    const targetPackage = pkgName.value
    const targetDid = user.value?.did ?? null
    const currentlyLiked = likesData.value.userHasLiked
    const currentLikes = likesData.value.totalLikes
    const previousMutation = localMutation.value
    const nextLiked = !currentlyLiked

    options?.onOptimisticToggle?.(nextLiked)

    localMutation.value = {
      totalLikes: currentlyLiked ? Math.max(currentLikes - 1, 0) : currentLikes + 1,
      userHasLiked: nextLiked,
    }

    isLikeActionPending.value = true

    try {
      const result = await togglePackageLike(targetPackage, currentlyLiked, user.value?.handle)
      if (pkgName.value !== targetPackage || (user.value?.did ?? null) !== targetDid) return
      if (result.success) {
        localMutation.value = {
          totalLikes: result.data.totalLikes,
          userHasLiked: result.data.userHasLiked,
        }
        userLikeData.value = {
          userHasLiked: result.data.userHasLiked,
          totalLikes: result.data.totalLikes,
        }
      } else {
        localMutation.value = previousMutation
      }
    } catch {
      if (pkgName.value === targetPackage && (user.value?.did ?? null) === targetDid) {
        localMutation.value = previousMutation
      }
    } finally {
      if (pkgName.value === targetPackage && (user.value?.did ?? null) === targetDid) {
        isLikeActionPending.value = false
      }
    }
  }

  return {
    likesData,
    isLoading,
    toggleLike,
  }
}
