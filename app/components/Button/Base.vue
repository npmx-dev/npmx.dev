<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    'disabled'?: boolean
    'type'?: 'button' | 'submit'
    'variant'?: 'primary' | 'secondary' | 'tag'
    'keyshortcut'?: string

    /**
     * Don't use this directly, use `keyshortcut` instead. Correctly HTML will be automatically generated and the shortcut will automatically be displayed in the UI.
     */
    'aria-keyshortcuts'?: never

    'classicon'?: string
  }>(),
  {
    type: 'button',
    variant: 'secondary',
  },
)

const el = useTemplateRef('el')

defineExpose({
  focus: () => el.value?.focus(),
})
</script>

<template>
  <button
    ref="el"
    class="group cursor-pointer inline-flex gap-x-1 items-center justify-center font-mono border border-border rounded-md transition-all duration-200 disabled:(opacity-40 cursor-not-allowed border-transparent) aria-pressed:(bg-fg text-bg border-fg hover:enabled:(text-bg/50)) bg-gradient-to-t dark:bg-gradient-to-b"
    :class="{
      'text-sm px-4 py-2': variant !== 'tag',
      'text-xs px-2 py-0.5': variant === 'tag',
      'from-fg/10 via-transparent to-transparent text-fg hover:enabled:(bg-accent/20 border-accent) focus-visible:enabled:(bg-accent/20 border-accent)':
        variant === 'tag' || variant === 'secondary',
      'text-black from-accent via-accent to-accent/30 hover:enabled:(bg-accent/50) focus-visible:enabled:(bg-accent/50)':
        variant === 'primary',
    }"
    :type="props.type"
    :disabled="
      /**
       * Unfortunately Vue _sometimes_ doesn't handle `disabled` correct,
       * resulting in an invalid `disabled=false` attribute in the final HTML.
       *
       * This fixes this.
       */
      disabled ? true : undefined
    "
    :aria-keyshortcuts="keyshortcut"
  >
    <span
      v-if="classicon"
      :class="[variant === 'tag' ? 'size-3' : 'size-4', classicon]"
      aria-hidden="true"
    />
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
