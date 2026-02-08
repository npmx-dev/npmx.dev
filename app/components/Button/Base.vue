<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    'disabled'?: boolean
    'type'?: 'button' | 'submit'
    'variant'?: 'primary' | 'secondary'
    'size'?: 'small' | 'medium'
    'keyshortcut'?: string

    /**
     * Do not use this directly. Use keyshortcut instead; it generates the correct HTML and displays the shortcut in the UI.
     */
    'aria-keyshortcuts'?: never

    'classicon'?: string
  }>(),
  {
    type: 'button',
    variant: 'secondary',
    size: 'medium',
  },
)

const el = useTemplateRef('el')

defineExpose({
  focus: () => el.value?.focus(),
  getBoundingClientRect: () => el.value?.getBoundingClientRect(),
})
</script>

<template>
  <button
    ref="el"
    class="group cursor-pointer inline-flex gap-x-1.5 items-center justify-center rounded-md active:rounded-4xl font-mono border border-solid [transition:background-color,color,border,outline_200ms,border-radius_100ms] focus-visible:(outline-2 outline-accent outline-offset-2) after:(content-[''] absolute inset-0 rounded-inherit) disabled:(opacity-40 cursor-not-allowed border-transparent)"
    :class="{
      'text-sm px-4 py-2': size === 'medium',
      'text-xs px-2 py-0.5': size === 'small',
      'text-fg bg-transparent border-transparent hover:(bg-fg/10 border-fg/10)':
        variant === 'secondary',
      'text-bg bg-fg border-fg hover:(bg-fg/80)': variant === 'primary',
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
      :class="[size === 'small' ? 'size-3' : 'size-4', classicon]"
      aria-hidden="true"
    />
    <slot />
    <kbd
      v-if="keyshortcut"
      class="ms-2 inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ keyshortcut }}
    </kbd>
  </button>
</template>
