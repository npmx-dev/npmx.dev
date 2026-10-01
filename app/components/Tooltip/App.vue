<script setup lang="ts">
const props = defineProps<{
  /** Tooltip text (optional when using content slot) */
  text?: string
  /** Position: 'top' | 'bottom' | 'left' | 'right' */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Enable interactive tooltip (pointer events + hide delay for clickable content) */
  interactive?: boolean
  /** Teleport target for the tooltip content (defaults to 'body') */
  to?: string | HTMLElement
  /** Whether to defer teleport rendering until after the component is mounted */
  defer?: boolean
  /** Offset distance in pixels (default: 4) */
  offset?: number
  /** Additional attributes to be applied to the tooltip element */
  tooltipAttr?: Record<string, unknown>
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

// Pointer clicks leave the trigger focused (e.g. a link opened in a new tab),
// and the browser re-fires `focusin` when the tab regains focus - which would
// re-open the tooltip with no pointer over it. Only keyboard focus should show it.
function showFromFocus(event: FocusEvent) {
  const target = event.target
  if (target instanceof Element && !target.matches(':focus-visible')) return
  show()
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

function hideImmediately() {
  if (hideTimeout.value) {
    clearTimeout(hideTimeout.value)
    hideTimeout.value = null
  }
  isVisible.value = false
}

// Opening a link in a new tab (or any other window/tab switch) never fires
// `mouseleave`/`focusout` on the trigger, so the tooltip would stay visible
// after returning to the page. Only listen while the tooltip is open.
const windowTarget = computed(() => (import.meta.client && isVisible.value ? window : undefined))
const documentTarget = computed(() =>
  import.meta.client && isVisible.value ? document : undefined,
)
useEventListener(windowTarget, 'blur', hideImmediately)
useEventListener(windowTarget, 'pagehide', hideImmediately)
useEventListener(documentTarget, 'visibilitychange', () => {
  if (document.hidden) hideImmediately()
})

const tooltipAttrs = computed(() => {
  const attrs: Record<string, unknown> = { role: 'tooltip', id: tooltipId, ...props.tooltipAttr }
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
    :to
    :defer
    :offset
    :tooltip-attr="tooltipAttrs"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="showFromFocus"
    @focusout="hide"
    :aria-describedby="isVisible ? tooltipId : undefined"
  >
    <slot />
    <template v-if="$slots.content" #content>
      <slot name="content" />
    </template>
  </TooltipBase>
</template>
