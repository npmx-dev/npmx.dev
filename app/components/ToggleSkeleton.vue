<script setup lang="ts">
defineProps<{
  label: string
}>()
</script>

<template>
  <div class="w-full flex items-center justify-between gap-4">
    <span class="text-sm text-fg font-medium text-start">
      {{ label }}
    </span>
    <span class="skeleton block h-6 w-11 shrink-0 rounded-full" />
  </div>
</template>
