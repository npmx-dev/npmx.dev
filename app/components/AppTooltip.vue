<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text */
  text: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
}>()

const isVisible = shallowRef(false)
const tooltipId = useId()

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full left-0 mt-1',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const tooltipPosition = computed(() => positionClasses[props.position || 'bottom'])

function show() {
  isVisible.value = true
}

function hide() {
  isVisible.value = false
}
</script>

<template>
  <div
    class="relative inline-flex"
    :aria-describedby="isVisible ? tooltipId : undefined"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />

    <Transition
      enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        :id="tooltipId"
        role="tooltip"
        class="absolute px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-nowrap z-[100] pointer-events-none"
        :class="tooltipPosition"
      >
        {{ text }}
      </div>
    </Transition>
  </div>
</template>
