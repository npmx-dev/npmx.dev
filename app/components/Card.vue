<script setup lang="ts">
defineProps<{
  /** Whether this is an exact match for the query */
  isExactMatch?: boolean
}>()
</script>

<template>
  <article
    class="group bg-bg-subtle border border-border rounded-lg p-4 sm:p-6 transition-[border-color,background-color] duration-200 hover:(border-border-hover bg-bg-muted) cursor-pointer relative focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50 focus-within:bg-bg-muted focus-within:border-border-hover"
    :class="{
      'border-accent/30 bg-accent/5': isExactMatch,
    }"
  >
    <!-- Glow effect for exact matches -->
    <div
      v-if="isExactMatch"
      class="absolute -inset-px rounded-lg bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 opacity-100 blur-sm -z-1 pointer-events-none motion-reduce:opacity-50"
      aria-hidden="true"
    />
    <slot />
  </article>
</template>
