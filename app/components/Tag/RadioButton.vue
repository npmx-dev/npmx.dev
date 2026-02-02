<script setup lang="ts">
const model = defineModel()

const props = defineProps<{
  disabled?: boolean
  /**
   * type should never be used, because this will always be a button.
   *
   * If you want a link use `TagLink` instead.
   *  */
  type?: never

  /** Shouldn't try to set `checked` explicitly, is handled internally */
  checked?: never
  value: string
}>()

const uid = useId()
const internalId = `${model.value}-${uid}`

const checked = computed(() => model.value === props.value)

const onChange = () => {
  model.value = props.value
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <label
    class="inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded transition-colors duration-200 focus-within:ring-2 focus-within:ring-fg"
    :class="[
      /** TODO: This should ideally be done in CSS only, but right now I can't get it working with UnoCSS */
      checked
        ? 'peer-checked:(bg-fg text-bg border-fg hover:(text-text-bg/50))'
        : 'bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover)',
      {
        'opacity-50 cursor-not-allowed': props.disabled,
      },
    ]"
    :htmlFor="internalId"
  >
    <input
      type="radio"
      :name="props.value"
      :id="internalId"
      :value="props.value"
      :checked="checked"
      :disabled="props.disabled ? true : undefined"
      @change="onChange"
    />
    <slot />
  </label>
</template>

<style scoped>
input[type='radio'] {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
</style>
