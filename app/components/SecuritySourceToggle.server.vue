<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Smaller trigger button, for dense contexts like the stats banner */
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)
</script>

<template>
  <div class="relative">
    <div
      class="flex items-center justify-center rounded-md text-fg-subtle"
      :class="compact ? 'w-6 h-6' : 'w-8 h-8'"
    >
      <span class="i-lucide:shield w-4 h-4" aria-hidden="true" />
    </div>
  </div>
</template>
