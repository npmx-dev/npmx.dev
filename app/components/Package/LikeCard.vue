<script setup lang="ts">
const props = defineProps<{
  packageUrl: string
}>()

function extractPackageFromRef(ref: string) {
  const { pkg } = /https:\/\/npmx.dev\/package\/(?<pkg>.*)/.exec(ref).groups
  return pkg
}

const name = computed(() => extractPackageFromRef(props.packageUrl))

const { user } = useAtproto()

const authModal = useModal('auth-modal')

const { data: likesData } = useFetch(() => `/api/social/likes/${name}`, {
  default: () => ({ totalLikes: 0, userHasLiked: false }),
  server: false,
})

const isLikeActionPending = ref(false)

const likeAction = async () => {
  if (user.value?.handle == null) {
    authModal.open()
    return
  }

  if (isLikeActionPending.value) return

  const currentlyLiked = likesData.value?.userHasLiked ?? false
  const currentLikes = likesData.value?.totalLikes ?? 0

  // Optimistic update
  likesData.value = {
    totalLikes: currentlyLiked ? currentLikes - 1 : currentLikes + 1,
    userHasLiked: !currentlyLiked,
  }

  isLikeActionPending.value = true

  try {
    const result = await togglePackageLike(name, currentlyLiked, user.value?.handle)

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
  <NuxtLink :to="packageRoute(name)">
    <BaseCard class="group font-mono flex justify-between">
      {{ name }}
      <ClientOnly>
        <TooltipApp
          :text="likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')"
          position="bottom"
        >
          <button
            @click="likeAction"
            type="button"
            :title="likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')"
            class="inline-flex items-center gap-1.5 font-mono text-sm text-fg hover:text-fg-muted transition-colors duration-200"
            :aria-label="
              likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
            "
          >
            <span
              :class="
                likesData?.userHasLiked
                  ? 'i-lucide-heart-minus text-red-500'
                  : 'i-lucide-heart-plus'
              "
              class="w-4 h-4"
              aria-hidden="true"
            />
            <span>{{ formatCompactNumber(likesData?.totalLikes ?? 0, { decimals: 1 }) }}</span>
          </button>
        </TooltipApp>
      </ClientOnly>
      <p class="transition-transform duration-150 group-hover:rotate-45">↗</p>
    </BaseCard>
  </NuxtLink>
</template>
