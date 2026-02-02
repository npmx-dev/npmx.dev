<script setup lang="ts">
const props = withDefaults(defineProps<{ as?: string | Component }>(), { as: 'span' })
</script>

<template>
  <component
    :is="as"
    class="inline-flex items-center px-2 py-0.5 text-xs font-mono text-fg-muted bg-bg-muted border border-border rounded"
  >
    <slot />
  </component>
</template>
