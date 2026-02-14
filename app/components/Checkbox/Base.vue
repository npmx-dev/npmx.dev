<script setup lang="ts">
const model = defineModel<boolean>()

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    size?: 'small' | 'medium'
    hideRadio?: boolean
    value: string

    indeterminate?: boolean

    variant?: 'default' | 'tag'

    hideCheckbox?: boolean

    /**
     * type should never be used, because this will always be a radio button.
     *
     * If you want a link use `TagLink` instead.
     *  */
    type?: never
  }>(),
  {
    size: 'medium',
    variant: 'default',
  },
)

const el = useTemplateRef('el')

defineExpose({
  focus: () => el.value?.focus(),
  getBoundingClientRect: () => el.value?.getBoundingClientRect(),
})

const uid = useId()
const internalId = `checkbox-${uid}`
</script>

<template>
  <label
    :htmlFor="internalId"
    class="text-fg-muted hover:(text-fg) inline-flex items-center font-mono rounded transition-colors duration-200 has-checked:(hover:(text-fg)) has-disabled:(opacity-50 pointer-events-none)"
    :class="{
      'bg-bg-muted hover:(bg-fg/10)': variant === 'tag',
      'has-checked:(bg-fg/20 text-fg)': variant === 'tag' && !hideCheckbox,
      'has-checked:(bg-fg text-bg)': variant === 'tag' && hideCheckbox,
      'has-checked:(text-fg)': variant !== 'tag',
      'text-sm': size === 'medium',
      'text-xs': size === 'small',
      'px-4 py-2': size === 'medium' && variant === 'tag',
      'px-2 py-0.5': size === 'small' && variant === 'tag',
    }"
  >
    <input
      type="checkbox"
      :value="props.value"
      :checked="model"
      :id="internalId"
      :disabled="props.disabled ? true : undefined"
      @change="$emit('update:modelValue', !model)"
      :indeterminate="props.indeterminate"
      class="size-[1em] bg-bg-muted border-border rounded disabled:opacity-50 me-1"
      :class="{ 'sr-only': hideCheckbox }"
    />
    <slot />
  </label>
</template>
