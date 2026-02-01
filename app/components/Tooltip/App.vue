<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text */
  text: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
}>()

const isVisible = shallowRef(false)
const tooltipId = useId()

function show() {
  isVisible.value = true
}

function hide() {
  isVisible.value = false
}
</script>

<template>
  <TooltipBase
    :text
    :isVisible
    :position
    :tooltip-attr="{ role: 'tooltip', id: tooltipId }"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    :aria-describedby="isVisible ? tooltipId : undefined"
    ><slot
  /></TooltipBase>
</template>
