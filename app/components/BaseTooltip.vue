<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

const props = defineProps<{
  /** Tooltip text */
  text: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** is tooltip visible */
  isVisible: boolean
  /** attributes for tooltip element */
  tooltipAttr?: HTMLAttributes
}>()

const positionClasses: Record<string, string> = {
  top: 'bottom-full inset-is-1/2 -translate-x-1/2 mb-1',
  bottom: 'top-full inset-is-0 mt-1',
  left: 'inset-ie-full top-1/2 -translate-y-1/2 me-2',
  right: 'inset-is-full top-1/2 -translate-y-1/2 ms-2',
}

const tooltipPosition = computed(() => positionClasses[props.position || 'bottom'])
</script>

<template>
  <div class="relative inline-flex">
    <slot />

    <Transition
      enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.isVisible"
        class="absolute px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-nowrap z-[100] pointer-events-none"
        :class="tooltipPosition"
        v-bind="tooltipAttr"
      >
        {{ text }}
      </div>
    </Transition>
  </div>
</template>
