<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text */
  text: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** is tooltip visible */
  isVisible: boolean
}>()
</script>

<template>
  <BaseTooltip :text :isVisible :position :tooltip-attr="{ 'aria-live': 'polite' }"
    ><slot
  /></BaseTooltip>
</template>
