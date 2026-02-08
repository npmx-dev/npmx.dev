<script setup lang="ts">
import TooltipApp from '~/components/Tooltip/App.vue'

defineProps<{
  label?: string
  description?: string
  tooltip?: string
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
  class?: string | Record<string, boolean> | Array<string | Record<string, boolean>>
}>()

const checked = defineModel<boolean>({
  default: false,
})
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center justify-start gap-3 group focus-visible:outline-none py-1 -my-1"
    role="switch"
    :aria-checked="checked"
    @click="checked = !checked"
    :class="class"
  >
    <TooltipApp v-if="tooltip && label" :text="tooltip" :position="tooltipPosition ?? 'top'">
      <span class="text-sm font-mono text-fg group-hover:text-fg/80 transition-colors select-none">
        {{ label }}
      </span>
    </TooltipApp>
    <span
      v-else-if="label"
      class="text-sm font-mono text-fg group-hover:text-fg/80 transition-colors select-none"
    >
      {{ label }}
    </span>
    <span
      class="inline-flex items-center h-6 w-11 shrink-0 rounded-full border p-0.25 transition-colors duration-200 shadow-sm ease-in-out motion-reduce:transition-none group-focus-visible:(outline-accent/70 outline-offset-2 outline-solid)"
      :class="
        checked
          ? 'bg-accent border-accent group-hover:bg-accent/80'
          : 'bg-fg/50 border-fg/50 group-hover:bg-fg/70'
      "
      aria-hidden="true"
    >
      <span
        class="block h-5 w-5 rounded-full bg-bg shadow-sm transition-transform duration-200 ease-in-out motion-reduce:transition-none"
      />
    </span>
  </button>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>

<style scoped>
button[aria-checked='false'] > span:last-of-type > span {
  translate: 0;
}
button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(100%);
}
html[dir='rtl'] button[aria-checked='true'] > span:last-of-type > span {
  translate: calc(-100%);
}

@media (forced-colors: active) {
  /* make toggle tracks and thumb visible in forced colors. */
  button[role='switch'] {
    & > span:last-of-type {
      forced-color-adjust: none;
    }

    &[aria-checked='false'] > span:last-of-type {
      background: Canvas;
      border-color: CanvasText;

      & > span {
        background: CanvasText;
      }
    }

    &[aria-checked='true'] > span:last-of-type {
      background: Highlight;
      border-color: Highlight;

      & > span {
        background: HighlightText;
      }
    }
  }
}
</style>
