<script setup lang="ts">
const model = defineModel<string>()

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    size?: 'small' | 'medium'
    hideRadio?: boolean
    value: string

    /**
     * type should never be used, because this will always be a radio button.
     *
     * If you want a link use `TagLink` instead.
     *  */
    type?: never

    /** Shouldn't try to set `checked` explicitly, is handled internally */
    checked?: never
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
const internalId = `${model.value}-${uid}`
const checked = computed(() => model.value === props.value)

/** Todo: This shouldn't be necessary, but using v-model on `input type=radio` doesn't work as expected in Vue */
const onChange = () => {
  model.value = props.value
}
</script>

<template>
  <label
    class="text-fg-muted hover:(text-fg) inline-flex items-center font-mono rounded transition-colors duration-200 has-checked:(text-fg hover:(text-fg)) has-disabled:(opacity-50 pointer-events-none) before:content-['']"
    :class="{
      'text-sm': size === 'medium',
      'text-xs': size === 'small',
    }"
    :htmlFor="internalId"
  >
    <input
      type="radio"
      :id="internalId"
      :value="props.value"
      :checked="checked"
      :disabled="props.disabled ? true : undefined"
      @change="onChange"
      class="me-1"
    />
    <slot />
  </label>
</template>
