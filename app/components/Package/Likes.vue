<script lang="ts" setup>
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

const compactNumberFormatter = useCompactNumberFormatter()

const {
  likesData,
  isLoading: isLoadingLikeData,
  toggleLike,
} = usePackageLikes(() => props.packageName)

const heartAnimStyle = computed(() => {
  if (likeAnimKey.value === 0 || prefersReducedMotion.value) return {}
  return {
    animation: likesData.value.userHasLiked
      ? 'heart-spring 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards'
      : 'heart-unlike 0.3s ease forwards',
  }
})

const isPackageLiked = computed(() => likesData.value.userHasLiked)
const topLikedRank = computed(() => likesData.value.topLikedRank)
const likeButtonLabel = computed(() =>
  isPackageLiked.value ? $t('package.likes.unlike') : $t('package.likes.like'),
)
const likeTooltipLabel = computed(() =>
  isLoadingLikeData.value ? $t('common.loading') : likeButtonLabel.value,
)
const topLikedBadgeLabel = computed(() =>
  topLikedRank.value == null
    ? ''
    : $t('package.likes.top_rank_link_label', { rank: topLikedRank.value }),
)

const likeAction = async () => {
  await toggleLike({
    onOptimisticToggle(nextLiked) {
      likeAnimKey.value++

      if (nextLiked && !prefersReducedMotion.value) {
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
    },
  })
}
</script>

<template>
  <div class="relative inline-flex items-center">
    <TooltipApp :text="likeTooltipLabel" position="bottom" class="items-center" strategy="fixed">
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
          <span class="relative inline-block min-w-[4ch] text-center">
            <span :class="{ invisible: isLoadingLikeData }">{{
              compactNumberFormatter.format(likesData?.totalLikes ?? 0)
            }}</span>
            <span
              v-if="isLoadingLikeData"
              class="i-svg-spinners:ring-resize absolute inset-0 m-auto w-3 h-3"
              aria-hidden="true"
            />
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
      class="top-liked-badge-anchor"
    >
      <NuxtLink
        :to="{ name: 'leaderboard-likes' }"
        :aria-label="topLikedBadgeLabel"
        data-testid="top-liked-badge"
        class="top-liked-badge"
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

.top-liked-badge-anchor {
  position: absolute;
  inset-inline-end: -0.5rem;
  top: -0.4rem;
  z-index: 1;
}

.top-liked-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  padding: 0.125rem 0.375rem;
  border: 1px solid var(--bg);
  border-radius: 9999px;
  background: var(--accent);
  color: var(--bg);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  box-shadow: 0 2px 6px color-mix(in oklab, var(--accent) 14%, transparent);
  transition: box-shadow 160ms ease;
}

.top-liked-badge:hover {
  box-shadow: 0 4px 10px color-mix(in oklab, var(--accent) 18%, transparent);
}

.top-liked-badge:focus-visible {
  outline: 2px solid var(--fg);
  outline-offset: 2px;
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
