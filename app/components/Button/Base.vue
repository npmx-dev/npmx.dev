<script setup lang="ts">
import type { IconClass } from '~/types'

/**
 * A base button component that supports multiple variants, sizes, and states as well as icons and keyboard shortcuts.
 */
defineOptions({
  name: 'ButtonBase',
})

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    /** @default "button" */
    type?: 'button' | 'submit'
    /** @default "secondary" */
    variant?: 'primary' | 'secondary'
    /** @default "md" */
    size?: 'sm' | 'md'
    /** Keyboard shortcut hint */
    ariaKeyshortcuts?: string
    /** Forces the button to occupy the entire width of its container. */
    block?: boolean

    classicon?: IconClass
  }>(),
  {
    type: 'button',
    variant: 'secondary',
    size: 'md',
  },
)

const el = useTemplateRef('el')
const slots = defineSlots<{
  default?: () => unknown
}>()
const iconOnly = computed(() => !!props.classicon && !slots.default)

const keyboardShortcutsEnabled = useKeyboardShortcuts()

defineExpose({
  focus: () => el.value?.focus(),
  getBoundingClientRect: () => el.value?.getBoundingClientRect(),
})
</script>

<template>
  <button
    ref="el"
    class="group gap-x-1 items-center justify-center font-mono border border-border-elevated/60 rounded-md transition-all duration-200 cursor-pointer disabled:(opacity-40 cursor-not-allowed border-transparent)"
    :class="{
      'inline-flex': !block,
      'flex': block,
      'text-sm py-2': size === 'md' && !iconOnly,
      'text-sm p-2': size === 'md' && !!iconOnly,
      'px-4': size === 'md' && !classicon && !iconOnly,
      'ps-3 pe-4': size === 'md' && !!classicon && !iconOnly,
      'text-xs py-0.5': size === 'sm' && !iconOnly,
      'text-xs p-0.5': size === 'sm' && !!iconOnly,
      'px-2': size === 'sm' && !classicon && !iconOnly,
      'ps-1.5 pe-2': size === 'sm' && !!classicon && !iconOnly,
      'bg-transparent text-fg hover:enabled:(bg-bg-elevated) focus-visible:enabled:(bg-bg-elevated) aria-pressed:(bg-bg-muted border-border-hover hover:enabled:(bg-bg-muted text-fg/50))':
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
    :aria-keyshortcuts="keyboardShortcutsEnabled ? ariaKeyshortcuts : undefined"
  >
    <span v-if="classicon" class="size-[1em]" :class="classicon" aria-hidden="true" />
    <slot />
    <kbd
      v-if="keyboardShortcutsEnabled && ariaKeyshortcuts"
      data-kbd-hint
      class="ms-2 inline-flex items-center justify-center w-4 h-4 text-xs text-fg bg-bg-muted border border-border rounded no-underline"
      aria-hidden="true"
    >
      {{ ariaKeyshortcuts }}
    </kbd>
  </button>
</template>
