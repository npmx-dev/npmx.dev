<script setup lang="ts">
import type { ReactionState } from '#shared/types/social'

const props = defineProps<{
  identifier: string
  rkey: string
}>()

const follows = defineModel<ReactionState>({ required: true })
const { toggle } = useCollectionReaction(follows, 'follow', () => props)

const compactNumberFormatter = useCompactNumberFormatter()
const label = computed(() =>
  follows.value.viewerHas ? $t('collections.unfollow_label') : $t('collections.follow_label'),
)

// For the page's command palette entries
defineExpose({ toggle })
</script>

<template>
  <!-- No aria-pressed: the visible label already changes between Follow and Following -->
  <TooltipApp :text="label" position="bottom" strategy="fixed">
    <ButtonBase
      :classicon="follows.viewerHas ? 'i-lucide:bell-ring' : 'i-lucide:bell-plus'"
      @click="toggle"
    >
      {{ follows.viewerHas ? $t('collections.following') : $t('collections.follow') }}
      <span class="text-fg-muted" aria-hidden="true">
        {{ compactNumberFormatter.format(follows.total) }}
      </span>
      <span class="sr-only">
        {{ $t('collections.followers', { count: $n(follows.total) }, follows.total) }}
      </span>
    </ButtonBase>
  </TooltipApp>
</template>
