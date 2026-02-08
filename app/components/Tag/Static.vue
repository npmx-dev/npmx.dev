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
    class="bg-bg-muted text-fg-muted inline-flex gap-x-1 items-center justify-center font-mono border border-transparent rounded-md text-xs px-2 py-0.5"
    :class="{ 'opacity-40': variant === 'ghost' }"
  >
    <span v-if="classicon" :class="['size-3', classicon]" aria-hidden="true" />
    <slot />
  </component>
</template>
