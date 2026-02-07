<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
  /**
   * type should never be used, because this will always be a button.
   *
   * If you want a link use `TagLink` instead.
   *  */
  type?: never
  pressed?: boolean
}>()
</script>

<template>
  <button
    class="inline-flex items-center px-2 py-0.5 text-xs font-mono border border-solid rounded transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
    :class="[
      pressed
        ? 'bg-fg text-bg border-fg hover:(text-text-bg/50 bg-fg-muted)'
        : 'bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover)',
      {
        'opacity-50 cursor-not-allowed': disabled,
      },
    ]"
    type="button"
    :disabled="disabled ? true : undefined"
    :aria-pressed="pressed"
  >
    <slot />
  </button>
</template>
