<script setup lang="ts">
import type { ReactionState } from '#shared/types/social'

const props = defineProps<{
  identifier: string
  rkey: string
}>()

const likes = defineModel<ReactionState>({ required: true })
const { toggle: toggleLike } = useCollectionReaction(likes, 'like', () => props)

const compactNumberFormatter = useCompactNumberFormatter()
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
// Bumped per click so the heart animates again; 0 means no animation on first render
const animKey = shallowRef(0)
const heartAnimStyle = computed(() => {
  if (animKey.value === 0 || prefersReducedMotion.value) return {}
  return {
    animation: likes.value.viewerHas
      ? 'heart-spring 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards'
      : 'heart-unlike 0.3s ease forwards',
  }
})

const label = computed(() =>
  likes.value.viewerHas ? $t('collections.unlike') : $t('collections.like'),
)

async function toggle() {
  animKey.value++
  await toggleLike()
}

// For the page's command palette entries
defineExpose({ toggle })
</script>

<template>
  <!-- No aria-pressed: the label already changes between Like and Unlike -->
  <TooltipApp :text="label" position="bottom" strategy="fixed">
    <ButtonBase @click="toggle">
      <span
        :key="animKey"
        :class="
          likes.viewerHas ? 'i-lucide:heart-minus fill-red-500 text-red-500' : 'i-lucide:heart-plus'
        "
        :style="heartAnimStyle"
        class="inline-block size-4"
        aria-hidden="true"
      />
      <span aria-hidden="true">{{ compactNumberFormatter.format(likes.total) }}</span>
      <span class="sr-only">
        {{ label }}, {{ $t('collections.like_count', { count: $n(likes.total) }, likes.total) }}
      </span>
    </ButtonBase>
  </TooltipApp>
</template>
