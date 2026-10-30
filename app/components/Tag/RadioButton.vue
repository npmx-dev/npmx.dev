<script setup lang="ts" generic="T extends string">
const props = defineProps<{
  disabled?: boolean
  name?: string
  /**
   * type should never be used, because this will always be a radio button.
   *
   * If you want a link use `TagLink` instead.
   *  */
  type?: never

  /** Shouldn't try to set `checked` explicitly, is handled internally */
  checked?: never
  value: T
}>()

const model = defineModel<T>({ required: true })

const uid = useId()
const internalId = `${model.value}-${uid}`
const isChecked = computed(() => model.value === props.value)
/** Todo: This shouldn't be necessary, but using v-model on `input type=radio` doesn't work as expected in Vue */
const onChange = () => {
  model.value = props.value
}
</script>

<template>
  <div>
    <input
      type="radio"
      :id="internalId"
      :name="name"
      :value="props.value"
      :checked="isChecked"
      :disabled="props.disabled ? true : undefined"
      @change="onChange"
      class="peer sr-only"
    />
    <label
      class="bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover) inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded transition-colors duration-200 peer-focus-visible:(outline-2 outline-accent/70 outline-offset-2) border-none peer-checked:(bg-fg text-bg border-fg hover:(text-text-bg/50)) peer-disabled:(opacity-50 pointer-events-none)"
      :for="internalId"
    >
      <slot />
    </label>
  </div>
</template>
