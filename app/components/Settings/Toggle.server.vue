<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
}>()
</script>

<template>
  <div class="w-full flex items-center justify-between gap-4 py-1 -my-1">
    <span v-if="label" class="text-sm text-fg font-medium text-start">
      {{ label }}
    </span>
    <SkeletonBlock class="h-6 w-11 shrink-0 rounded-full" />
  </div>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>
