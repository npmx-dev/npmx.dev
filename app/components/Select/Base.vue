<script setup lang="ts">
const model = defineModel<string | undefined>({ default: undefined })

const SELECT_SIZES = {
  none: '',
  sm: 'text-xs px-2 py-1.75 rounded-md',
  md: 'text-sm px-3 py-2.25 rounded-lg',
  lg: 'text-base px-6 py-4 rounded-xl',
}

export type SelectBaseProps = {
  disabled?: boolean
  size?: keyof typeof SELECT_SIZES
}

const props = withDefaults(defineProps<SelectBaseProps>(), {
  size: 'md',
})
</script>

<template>
  <select
    v-model="model"
    class="bg-bg border border-border font-mono text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 hover:border-fg-subtle outline-2 outline-transparent outline-offset-2 focus:border-accent focus-visible:outline-accent/70 disabled:(opacity-50 cursor-not-allowed)"
    :class="[SELECT_SIZES[size]]"
    :disabled="
      /** Catching Vue render-bug of invalid `disabled=false` attribute in the final HTML */
      disabled ? true : undefined
    "
  >
    <slot />
  </select>
</template>
