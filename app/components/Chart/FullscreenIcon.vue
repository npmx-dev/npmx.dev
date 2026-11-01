<script setup lang="ts">
defineProps<{
  isFullscreen: boolean
}>()
</script>

<template>
  <span
    class="w-6 h-6 text-fg-subtle pointer-events-none"
    :class="isFullscreen ? 'i-lucide:minimize' : 'i-lucide:maximize'"
    aria-hidden="true"
  />
</template>
