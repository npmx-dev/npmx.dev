<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    compact?: boolean
    linked?: boolean
  }>(),
  { linked: true },
)

const stagedPublishingDocs = 'https://docs.npmjs.com/staged-publishing/'
</script>

<template>
  <a
    v-if="props.linked !== false"
    :href="stagedPublishingDocs"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center justify-center gap-1 text-xs font-mono text-fg-muted hover:text-fg transition-colors duration-200 min-w-6 min-h-6"
    :title="$t('badges.staged_publish.title')"
  >
    <span
      class="i-lucide:shield-user shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
      aria-hidden="true"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">
      {{ $t('badges.staged_publish.label') }}
    </span>
  </a>
  <span
    v-else
    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted"
    :title="$t('badges.staged_publish.title')"
  >
    <span
      class="i-lucide:shield-user shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
      aria-hidden="true"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">
      {{ $t('badges.staged_publish.label') }}
    </span>
  </span>
</template>
