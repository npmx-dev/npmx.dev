<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text */
  text: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
}>()

const isVisible = ref(false)

const positionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full left-0 mt-1',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const tooltipPosition = computed(() => positionClasses[props.position || 'bottom'])
</script>

<template>
  <div
    class="relative inline-flex"
    @mouseenter="isVisible = true"
    @mouseleave="isVisible = false"
    @focus="isVisible = true"
    @blur="isVisible = false"
  >
    <slot />

    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isVisible"
        role="tooltip"
        class="absolute px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-nowrap z-[100] pointer-events-none"
        :class="tooltipPosition"
      >
        {{ text }}
      </div>
    </Transition>
  </div>
</template>
