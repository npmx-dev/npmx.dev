<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    type?: 'button' | 'submit'
    variant?: 'primary' | 'secondary'
    size?: 'small' | 'medium'
    ariaKeyshortcuts?: string
    block?: boolean

    classicon?: string
  }>(),
  {
    type: 'button',
    variant: 'secondary',
    size: 'medium',
  },
)

const el = useTemplateRef('el')
const slots = useSlots()
const iconOnly = computed(() => !!props.classicon && !slots.default)

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
      'text-sm py-2': size === 'medium' && !iconOnly,
      'text-sm p-2': size === 'medium' && !!iconOnly,
      'px-4': size === 'medium' && !classicon && !iconOnly,
      'ps-3 pe-4': size === 'medium' && !!classicon && !iconOnly,
      'text-xs py-0.5': size === 'small' && !iconOnly,
      'text-xs p-0.5': size === 'small' && !!iconOnly,
      'px-2': size === 'small' && !classicon && !iconOnly,
      'ps-1.5 pe-2': size === 'small' && !!classicon && !iconOnly,
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
