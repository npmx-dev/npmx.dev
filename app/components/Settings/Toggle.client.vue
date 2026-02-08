<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
  class?: string
}>()

const checked = defineModel<boolean>({
  default: false,
})
</script>

<template>
  <button
    type="button"
    class="w-full flex items-center justify-between gap-4 group focus-visible:outline-none py-1 -my-1"
    role="switch"
    :aria-checked="checked"
    @click="checked = !checked"
    :class="class"
  >
    <span v-if="label" class="text-sm text-fg font-medium text-start">
      {{ label }}
    </span>
    <span
      class="inline-flex items-center h-6 w-11 shrink-0 rounded-full border p-0.25 transition-colors duration-200 shadow-sm ease-in-out motion-reduce:transition-none cursor-pointer group-focus-visible:(outline-accent/70 outline-offset-2 outline-solid)"
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
