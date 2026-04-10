<script lang="ts" setup>
import type { PackageLikes } from '#shared/types/social'
import { useModal } from '~/composables/useModal'
import { useAtproto } from '~/composables/atproto/useAtproto'
import { togglePackageLike } from '~/utils/atproto/likes'

const props = defineProps<{
  packageName: string
}>()

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

const likeAnimKey = shallowRef(0)
const showLikeFloat = shallowRef(false)
const likeFloatKey = shallowRef(0)
let likeFloatTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (likeFloatTimer !== null) {
    clearTimeout(likeFloatTimer)
    likeFloatTimer = null
  }
})

const heartAnimStyle = computed(() => {
  if (likeAnimKey.value === 0 || prefersReducedMotion.value) return {}
  return {
    animation: likesData.value?.userHasLiked
      ? 'heart-spring 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards'
      : 'heart-unlike 0.3s ease forwards',
  }
})

//atproto
// TODO: Maybe set this where it's not loaded here every load?
const { user } = useAtproto()

const authModal = useModal('auth-modal')
const compactNumberFormatter = useCompactNumberFormatter()

const { data: likesData, status: likeStatus } = useFetch<PackageLikes>(
  () => `/api/social/likes/${props.packageName}`,
  {
    default: () => ({
      totalLikes: 0,
      userHasLiked: false,
      topLikedRank: null,
    }),
    server: false,
  },
)

const isLoadingLikeData = computed(
  () => likeStatus.value === 'pending' || likeStatus.value === 'idle',
)
const isPackageLiked = computed(() => likesData.value?.userHasLiked ?? false)
const topLikedRank = computed(() => likesData.value?.topLikedRank ?? null)
const likeButtonLabel = computed(() =>
  isPackageLiked.value ? $t('package.likes.unlike') : $t('package.likes.like'),
)
const likeTooltipText = computed(() =>
  isLoadingLikeData.value ? $t('common.loading') : likeButtonLabel.value,
)
const topLikedBadgeLabel = computed(() =>
  topLikedRank.value == null
    ? ''
    : $t('package.likes.top_rank_link_label', { rank: topLikedRank.value }),
)

const isLikeActionPending = shallowRef(false)

const likeAction = async () => {
  if (user.value?.handle == null) {
    authModal.open()
    return
  }

  if (isLikeActionPending.value) return

  const currentlyLiked = likesData.value?.userHasLiked ?? false
  const currentLikes = likesData.value?.totalLikes ?? 0
  const previousLikesState: PackageLikes = {
    totalLikes: currentLikes,
    userHasLiked: currentlyLiked,
    topLikedRank: topLikedRank.value,
  }

  likeAnimKey.value++

  if (!currentlyLiked && !prefersReducedMotion.value) {
    if (likeFloatTimer !== null) {
      clearTimeout(likeFloatTimer)
      likeFloatTimer = null
    }
    likeFloatKey.value++
    showLikeFloat.value = true
    likeFloatTimer = setTimeout(() => {
      showLikeFloat.value = false
      likeFloatTimer = null
    }, 850)
  }

  // Optimistic update
  likesData.value = {
    ...previousLikesState,
    totalLikes: currentlyLiked ? currentLikes - 1 : currentLikes + 1,
    userHasLiked: !currentlyLiked,
  }

  isLikeActionPending.value = true

  try {
    const result = await togglePackageLike(props.packageName, currentlyLiked, user.value?.handle)
    likesData.value = result.success
      ? {
          ...previousLikesState,
          ...result.data,
          topLikedRank: result.data.topLikedRank ?? previousLikesState.topLikedRank,
        }
      : previousLikesState
  } catch {
    likesData.value = previousLikesState
  } finally {
    isLikeActionPending.value = false
  }
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <TooltipApp :text="likeTooltipText" position="bottom" class="items-center" strategy="fixed">
      <div class="relative inline-flex">
        <span v-if="showLikeFloat" :key="likeFloatKey" aria-hidden="true" class="like-float"
          >+1</span
        >
        <ButtonBase
          @click="likeAction"
          size="md"
          :aria-label="likeButtonLabel"
          :aria-pressed="isPackageLiked"
        >
          <span
            :key="likeAnimKey"
            :class="
              isPackageLiked
                ? 'i-lucide:heart-minus fill-red-500 text-red-500'
                : 'i-lucide:heart-plus'
            "
            :style="heartAnimStyle"
            aria-hidden="true"
            class="inline-block w-4 h-4"
          />
          <span
            v-if="isLoadingLikeData"
            class="i-svg-spinners:ring-resize w-3 h-3 my-0.5"
            aria-hidden="true"
          />
          <span v-else>
            {{ compactNumberFormatter.format(likesData?.totalLikes ?? 0) }}
          </span>
        </ButtonBase>
      </div>
    </TooltipApp>

    <TooltipApp
      v-if="topLikedRank != null"
      :text="$t('package.likes.top_rank_tooltip', { rank: topLikedRank })"
      position="left"
      :offset="8"
      strategy="fixed"
      class="absolute [inset-inline-end:-0.5rem] top-[-0.4rem] z-1"
    >
      <NuxtLink
        :to="{ name: 'leaderboard-likes' }"
        :aria-label="topLikedBadgeLabel"
        data-testid="top-liked-badge"
        class="inline-flex items-center justify-center min-w-5 rounded-full px-1.5 py-0.5 text-2xs font-bold leading-none no-underline text-[var(--bg)] border border-[var(--bg)] bg-[radial-gradient(circle_at_28%_25%,rgb(255_255_255_/_0.34),transparent_38%),linear-gradient(135deg,color-mix(in_oklab,white_10%,var(--accent))_0%,var(--accent)_100%)] shadow-[0_1px_0_rgb(255_255_255_/_0.32)_inset,0_2px_6px_color-mix(in_oklab,var(--accent)_14%,transparent)] transition-shadow duration-[160ms] hover:shadow-[0_1px_0_rgb(255_255_255_/_0.38)_inset,0_4px_10px_color-mix(in_oklab,var(--accent)_18%,transparent)] focus-visible:outline-2 focus-visible:outline-fg focus-visible:outline-offset-2"
      >
        <span>{{ $t('package.likes.top_rank_label', { rank: topLikedRank }) }}</span>
      </NuxtLink>
    </TooltipApp>
  </div>
</template>

<style scoped>
.like-float {
  position: absolute;
  top: 0;
  left: 50%;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-red-500, #ef4444);
  pointer-events: none;
  white-space: nowrap;
  animation: float-up 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@media (prefers-reduced-motion: reduce) {
  .like-float {
    display: none;
  }
}

@keyframes float-up {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(0);
  }
  15% {
    opacity: 1;
    transform: translateX(-50%) translateY(-4px);
  }
  80% {
    opacity: 1;
    transform: translateX(-50%) translateY(-20px);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-28px);
  }
}
</style>

<style>
@keyframes heart-spring {
  0% {
    transform: scale(1);
  }
  15% {
    transform: scale(0.78);
  }
  45% {
    transform: scale(1.55);
  }
  65% {
    transform: scale(0.93);
  }
  80% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes heart-unlike {
  0% {
    transform: scale(1);
  }
  30% {
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.05);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  @keyframes heart-spring {
    from,
    to {
      transform: scale(1);
    }
  }
  @keyframes heart-unlike {
    from,
    to {
      transform: scale(1);
    }
  }
}
</style>
