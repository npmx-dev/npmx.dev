<script setup lang="ts">
const props = defineProps<{
  /** Position of the popover panel: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
}>()

const isOpen = shallowRef(false)
const popoverId = useId()
const closeTimeout = shallowRef<ReturnType<typeof setTimeout> | null>(null)

const closeDelayMs = 500

// Panel placement relative to trigger
const panelPositionClasses: Record<string, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2',
  bottom: 'top-full left-1/2 -translate-x-1/2',
  left: 'right-full top-1/2 -translate-y-1/2',
  right: 'left-full top-1/2 -translate-y-1/2',
}

const panelPosition = computed(() => panelPositionClasses[props.position ?? 'bottom'])

function clearCloseTimeout() {
  if (closeTimeout.value !== null) {
    clearTimeout(closeTimeout.value)
    closeTimeout.value = null
  }
}

function open() {
  clearCloseTimeout()
  isOpen.value = true
}

function close() {
  clearCloseTimeout()
  closeTimeout.value = setTimeout(() => {
    closeTimeout.value = null
    isOpen.value = false
  }, closeDelayMs)
}

onBeforeUnmount(clearCloseTimeout)
</script>

<template>
  <div
    class="relative inline-flex"
    @mouseenter="open"
    @mouseleave="close"
    @focusin="open"
    @focusout="close"
  >
    <slot :popover-visible="isOpen" :popover-id="popoverId" />

    <Transition
      enter-active-class="transition-opacity duration-150 motion-reduce:transition-none"
      leave-active-class="transition-opacity duration-100 motion-reduce:transition-none"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        :id="popoverId"
        role="dialog"
        aria-modal="false"
        class="absolute font-mono text-xs text-fg bg-bg-subtle border border-border rounded-lg shadow-lg z-[100] pointer-events-auto px-4 py-3 min-w-[14rem] max-w-[22rem] whitespace-normal"
        :class="panelPosition"
        @mouseenter="open"
        @mouseleave="close"
      >
        <slot name="content" />
      </div>
    </Transition>
  </div>
</template>
