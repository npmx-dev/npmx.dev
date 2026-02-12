<script setup lang="ts">
const props = defineProps<{
  as?: string | Component
}>()
</script>

<template>
  <component
    :is="props.as || 'div'"
    class="inline-flex items-stretch [&>*:not(:first-child)]:(-ms-px rounded-is-none) [&>*:not(:last-child)]:rounded-ie-none [&>*:hover]:(relative z-40 scale-1) [&>*:active]:scale-1 [&>*:focus-visible]:(relative z-40)"
  >
    <slot />
  </component>
</template>
