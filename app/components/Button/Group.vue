<script setup lang="ts">
/**
 * Use `ButtonGroup` to group multiple buttons together with connected borders.
 */
defineOptions({
  name: 'ButtonGroup',
})

const props = defineProps<{
  as?: string | Component
}>()
</script>

<template>
  <component
    :is="props.as || 'div'"
    class="flex items-center shrink-0 [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none"
  >
    <slot />
  </component>
</template>
