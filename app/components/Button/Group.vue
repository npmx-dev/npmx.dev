<script setup lang="ts">
const props = defineProps<{
  as?: string | Component
}>()
</script>

<template>
  <component
    :is="props.as || 'div'"
    class="inline-flex items-stretch [&>*:not(:first-child)]:(-ml-px rounded-is-none) [&>*:not(:last-child)]:rounded-ie-none [&>*]:(relative) [&>*:hover]:(z-10 !scale-100) [&>*:focus-visible]:(z-40) [&>*:active]:(z-10 !scale-100)"
  >
    <slot />
  </component>
</template>
