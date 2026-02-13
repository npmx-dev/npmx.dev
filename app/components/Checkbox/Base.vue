<script setup lang="ts">
const model = defineModel<boolean>()

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    size?: 'small' | 'medium'
    hideRadio?: boolean
    value: string

    indeterminate?: boolean

    /**
     * type should never be used, because this will always be a radio button.
     *
     * If you want a link use `TagLink` instead.
     *  */
    type?: never
  }>(),
  {
    size: 'medium',
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
    class="bg-bg-muted text-fg-muted hover:(text-fg bg-fg/10) inline-flex items-center font-mono rounded transition-colors duration-200 has-checked:(bg-fg/20 text-fg hover:(text-fg)) has-disabled:(opacity-50 pointer-events-none)"
    :class="{
      'text-sm px-4 py-2': size === 'medium',
      'text-xs px-2 py-0.5': size === 'small',
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
    />
    <slot />
  </label>
</template>
