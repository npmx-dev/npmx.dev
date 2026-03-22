<script lang="ts" setup>
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

const { data: likesData, status: likeStatus } = useFetch(
  () => `/api/social/likes/${props.packageName}`,
  {
    default: () => ({ totalLikes: 0, userHasLiked: false }),
    server: false,
  },
)

const isLoadingLikeData = computed(
  () => likeStatus.value === 'pending' || likeStatus.value === 'idle',
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
    totalLikes: currentlyLiked ? currentLikes - 1 : currentLikes + 1,
    userHasLiked: !currentlyLiked,
  }

  isLikeActionPending.value = true

  try {
    const result = await togglePackageLike(props.packageName, currentlyLiked, user.value?.handle)

    isLikeActionPending.value = false

    if (result.success) {
      // Update with server response
      likesData.value = result.data
    } else {
      // Revert on error
      likesData.value = {
        totalLikes: currentLikes,
        userHasLiked: currentlyLiked,
      }
    }
  } catch {
    // Revert on error
    likesData.value = {
      totalLikes: currentLikes,
      userHasLiked: currentlyLiked,
    }
    isLikeActionPending.value = false
  }
}
</script>

<template>
  <TooltipApp
    :text="
      isLoadingLikeData
        ? $t('common.loading')
        : likesData?.userHasLiked
          ? $t('package.likes.unlike')
          : $t('package.likes.like')
    "
    position="bottom"
    class="items-center"
    strategy="fixed"
  >
    <div :class="$style.likeWrapper">
      <span v-if="showLikeFloat" :key="likeFloatKey" aria-hidden="true" :class="$style.likeFloat"
        >+1</span
      >
      <ButtonBase
        @click="likeAction"
        size="md"
        :aria-label="
          likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
        "
        :aria-pressed="likesData?.userHasLiked"
      >
        <span
          :key="likeAnimKey"
          :class="
            likesData?.userHasLiked
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
</template>

<style module>
.likeWrapper {
  position: relative;
  display: inline-flex;
}

.likeFloat {
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
  .likeFloat {
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
