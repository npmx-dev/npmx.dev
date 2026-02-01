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
  <TooltipBase :text :isVisible :position :tooltip-attr="{ 'aria-live': 'polite' }"
    ><slot
  /></TooltipBase>
</template>
