<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text (optional when using content slot) */
  text?: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Enable interactive tooltip (pointer events + hide delay for clickable content) */
  interactive?: boolean
}>()

const isVisible = shallowRef(false)
const tooltipId = useId()
const hideTimeout = shallowRef<ReturnType<typeof setTimeout> | null>(null)

function show() {
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  isVisible.value = true
}

function hide() {
  if (props.interactive) {
    // Delay hide so cursor can travel from trigger to tooltip
    hideTimeout.value = setTimeout(() => {
      isVisible.value = false
    }, 150)
  } else {
    isVisible.value = false
  }
}

const tooltipAttrs = computed(() => {
  const attrs: Record<string, unknown> = { role: 'tooltip', id: tooltipId }
  if (props.interactive) {
    attrs.onMouseenter = show
    attrs.onMouseleave = hide
  }
  return attrs
})
</script>

<template>
  <TooltipBase
    :text
    :isVisible
    :position
    :interactive
    :tooltip-attr="tooltipAttrs"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
    :aria-describedby="isVisible ? tooltipId : undefined"
  >
    <slot />
    <template v-if="$slots.content" #content>
      <slot name="content" />
    </template>
  </TooltipBase>
</template>
