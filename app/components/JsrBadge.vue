<script setup lang="ts">
defineProps<{
  /** JSR package URL (e.g., "https://jsr.io/@std/fs") */
  url: string
  /** Whether to show as compact (icon only) or full (with text) */
  compact?: boolean
}>()
</script>

<template>
  <a
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1 text-xs font-mono text-fg-muted hover:text-fg transition-colors duration-200"
    :title="$t('badges.jsr.title')"
  >
    <span
      class="i-simple-icons-jsr shrink-0"
      :class="compact ? 'w-3.5 h-3.5' : 'w-4 h-4'"
      aria-hidden="true"
    />
    <span v-if="!compact" class="sr-only sm:not-sr-only">{{ $t('badges.jsr.label') }}</span>
  </a>
</template>
