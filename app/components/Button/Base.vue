<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    disabled?: boolean
    type?: 'button' | 'submit'
    variant?: 'primary' | 'secondary'
    size?: 'small' | 'medium'
    classicon?: string
    ariaKeyshortcuts?: string
    block?: boolean
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
    class="group gap-x-1.5 relative items-center justify-center rounded-md active:scale-[0.98] font-mono border border-solid border-border transition-colors duration-200 outline-transparent focus-visible:(outline-2 outline-accent outline-offset-2) disabled:(opacity-40 cursor-not-allowed border-transparent)"
    :class="{
      'inline-flex': !block,
      'flex': block,
      'text-sm px-4 py-2': size === 'medium',
      'text-xs px-2 py-0.5': size === 'small',
      'text-bg bg-fg border-fg hover:(bg-fg/80)': variant === 'primary',
      'text-fg bg-bg hover:(bg-fg/10 border-fg/10)': variant === 'secondary',
      'opacity-40 cursor-not-allowed border-transparent': disabled,
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
