<script setup lang="ts">
const props = defineProps<{
  packageUrl: string
}>()

const compactNumberFormatter = useCompactNumberFormatter()

function extractPackageFromRef(ref: string) {
  return /https:\/\/npmx.dev\/package\/(?<pkg>.*)/.exec(ref)?.groups?.pkg ?? ref
}

const name = computed(() => extractPackageFromRef(props.packageUrl))

const { likesData, isLoading: isLoadingLikes, toggleLike } = usePackageLikes(name)
</script>

<template>
  <NuxtLink :to="packageRoute(name)" prefetch-on="interaction">
    <BaseCard class="font-mono flex justify-between min-w-0">
      <span class="truncate min-w-0" :title="name">{{ name }}</span>
      <div class="flex items-center gap-4 justify-between shrink-0">
        <ClientOnly>
          <TooltipApp
            v-if="!isLoadingLikes"
            :text="likesData.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')"
            position="bottom"
          >
            <button
              @click.prevent="toggleLike()"
              type="button"
              :title="
                likesData.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
              "
              class="inline-flex items-center gap-1.5 font-mono text-sm text-fg hover:text-fg-muted transition-colors duration-200"
              :aria-label="
                likesData.userHasLiked ? $t('package.likes.unlike') : $t('package.likes.like')
              "
            >
              <span
                :class="
                  likesData.userHasLiked
                    ? 'i-lucide-heart-minus text-red-500'
                    : 'i-lucide-heart-plus'
                "
                class="w-4 h-4"
                aria-hidden="true"
              />
              <span>{{ compactNumberFormatter.format(likesData.totalLikes) }}</span>
            </button>
          </TooltipApp>
        </ClientOnly>
        <p class="transition-transform duration-150 group-hover:rotate-45 pb-1">↗</p>
      </div>
    </BaseCard>
  </NuxtLink>
</template>
