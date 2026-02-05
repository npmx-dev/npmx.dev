<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { Placement } from '@floating-ui/vue'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'

const props = defineProps<{
  /** Tooltip text (optional when using content slot) */
  text?: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** is tooltip visible */
  isVisible: boolean
  /** Allow pointer events on tooltip (for interactive content like links) */
  interactive?: boolean
  /** attributes for tooltip element */
  tooltipAttr?: HTMLAttributes
}>()

const triggerRef = useTemplateRef('triggerRef')
const tooltipRef = useTemplateRef('tooltipRef')

const placement = computed<Placement>(() => props.position || 'bottom')

const { floatingStyles } = useFloating(triggerRef, tooltipRef, {
  placement,
  whileElementsMounted: autoUpdate,
  middleware: [offset(4), flip(), shift({ padding: 8 })],
})
</script>

<template>
  <div ref="triggerRef" class="inline-flex">
    <slot />

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
        leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="props.isVisible"
          ref="tooltipRef"
          class="px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-pre-line break-words max-w-xs z-[100]"
          :class="{ 'pointer-events-none': !interactive }"
          :style="floatingStyles"
          v-bind="tooltipAttr"
        >
          <slot name="content">{{ text }}</slot>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
