<script setup lang="ts">
import { useAtproto } from '~/composables/atproto/useAtproto'
import { togglePackageLike } from '~/utils/atproto/likes'
const props = defineProps<{
  packageUrl: string
}>()

const compactNumberFormatter = useCompactNumberFormatter()

function extractPackageFromRef(ref: string) {
  return /https:\/\/npmx.dev\/package\/(?<pkg>.*)/.exec(ref)?.groups?.pkg ?? ref
}

const name = computed(() => extractPackageFromRef(props.packageUrl))

const { user } = useAtproto()

const authModal = useModal('auth-modal')

const { data: likesData } = useFetch(() => `/api/social/likes/${name.value}`, {
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
    const result = await togglePackageLike(name.value, currentlyLiked, user.value?.handle)

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
  } catch (e) {
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
    <BaseCard class="font-mono flex justify-between min-w-0">
      <span class="truncate min-w-0" :title="name">{{ name }}</span>
      <div class="flex items-center gap-4 justify-between shrink-0">
        <ClientOnly>
          <TooltipApp
            :text="likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')"
            position="bottom"
          >
            <button
              @click.prevent="likeAction"
              type="button"
              :title="
                likesData?.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
              "
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
              <span>{{ compactNumberFormatter.format(likesData?.totalLikes ?? 0) }}</span>
            </button>
          </TooltipApp>
        </ClientOnly>
        <p class="transition-transform duration-150 group-hover:rotate-45 pb-1">↗</p>
      </div>
    </BaseCard>
  </NuxtLink>
</template>
