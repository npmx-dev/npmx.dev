<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** @default "button" */
    type?: 'button' | 'submit'
    /** @default "secondary" */
    variant?: 'primary' | 'secondary'
    /** @default "medium" */
    size?: 'small' | 'medium'
    /** Keyboard shortcut hint */
    ariaKeyshortcuts?: string
    /** Forces the button to occupy the entire width of its container. */
    block?: boolean
    /** Icon class (e.g., i-carbon-add) applied to the left of the text. */
    classicon?: string
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
    class="group gap-x-1 items-center justify-center font-mono border border-border rounded-md transition-all duration-200 disabled:(opacity-40 cursor-not-allowed border-transparent)"
    :class="{
      'inline-flex': !block,
      'flex': block,
      'text-sm px-4 py-2': size === 'medium',
      'text-xs px-2 py-0.5': size === 'small',
      'bg-transparent text-fg hover:enabled:(bg-fg/10) focus-visible:enabled:(bg-fg/10) aria-pressed:(bg-fg/10 border-fg/20 hover:enabled:(bg-fg/20 text-fg/50))':
        variant === 'secondary',
      'text-bg bg-fg hover:enabled:(bg-fg/50) focus-visible:enabled:(bg-fg/50) aria-pressed:(bg-fg text-bg border-fg hover:enabled:(text-bg/50))':
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
    :aria-keyshortcuts="ariaKeyshortcuts"
  >
    <span v-if="classicon" class="size-[1em]" :class="classicon" aria-hidden="true" />
    <slot />
    <kbd
      v-if="ariaKeyshortcuts"
      class="ms-2 inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ ariaKeyshortcuts }}
    </kbd>
  </button>
</template>
