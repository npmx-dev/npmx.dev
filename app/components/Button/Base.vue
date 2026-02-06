<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    'disabled'?: boolean
    'type'?: 'button' | 'submit'
    'variant'?: 'primary' | 'secondary' | 'tag'
    'keyshortcut'?: string

    /**
     * Don't use this directly, use `keyshortcut` instead. Correcty HTML will be automatically generated and the shortcut will automatically be displayed in the UI.
     */
    'aria-keyshortcuts'?: never
  }>(),
  {
    type: 'button',
    variant: 'secondary',
  },
)

const el = ref<HTMLButtonElement | null>(null)

defineExpose({
  focus: () => el.value?.focus(),
})
</script>

<template>
  <button
    ref="el"
    class="group cursor-pointer inline-flex gap-x-1 items-center justify-center font-mono border border-border rounded-md transition-all duration-200 disabled:(opacity-40 cursor-not-allowed border-transparent) aria-pressed:(bg-fg text-bg border-fg hover:enabled:(text-bg/50))"
    :class="{
      'text-sm px-4 py-2': variant !== 'tag',
      'text-xs px-2 py-0.5': variant === 'tag',
      'bg-bg-muted text-fg-muted hover:enabled:(text-fg border-border-hover)': variant === 'tag',
      'text-bg bg-fg hover:enabled:(bg-fg/90)': variant === 'primary',
      'bg-transparent text-fg hover:enabled:(bg-fg text-bg border-fg)': variant === 'secondary',
    }"
    :type="props.type"
    :disabled="disabled ? true : undefined"
    :aria-keyshortcuts="keyshortcut"
  >
    <slot />
    <kbd
      v-if="keyshortcut"
      class="inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ keyshortcut }}
    </kbd>
  </button>
</template>
