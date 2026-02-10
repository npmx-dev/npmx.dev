<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    as?: string | Component
    variant?: 'ghost' | 'default'

    classicon?: string
  }>(),
  { as: 'span', variant: 'default' },
)
</script>

<template>
  <component
    :is="as"
    class="bg-bg-muted text-fg-muted inline-flex gap-x-1 items-center justify-center font-mono border border-gray-400 dark:border-gray-500 rounded-md text-xs px-2 py-0.5"
    :class="{ 'opacity-80 border-dashed': variant === 'ghost' }"
  >
    <span v-if="classicon" class="size-[1em]" :class="classicon" aria-hidden="true" />
    <slot />
  </component>
</template>
