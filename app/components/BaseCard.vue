<script setup lang="ts">
defineProps<{
  /** Whether this is an exact match for the query */
  isExactMatch?: boolean
  selected?: boolean
  /** Index for keyboard navigation */
  index?: number
}>()
</script>

<template>
  <article
    :tabindex="index != null ? 0 : undefined"
    :data-result-index="index"
    class="group bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 transition-[border-color,background-color] duration-200 hover:(border-border-hover bg-bg-muted) cursor-pointer relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-bg focus-visible:ring-offset-2 focus-visible:ring-accent focus-visible:bg-bg-muted focus-visible:border-accent/50"
    :class="{
      'border-accent/30 contrast-more:border-accent/90 bg-accent/5': isExactMatch,
      'bg-fg-subtle/15!': selected,
    }"
  >
    <!-- Glow effect for exact matches -->
    <div
      v-if="isExactMatch"
      class="absolute -inset-px rounded-lg bg-gradient-to-r from-accent/0 via-accent/0 to-accent/10 opacity-100 blur-sm -z-1 pointer-events-none motion-reduce:opacity-50"
      aria-hidden="true"
    />
    <slot />
  </article>
</template>
