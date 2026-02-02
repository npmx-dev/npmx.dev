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
      :value="props.value"
      :checked="checked"
      :disabled="props.disabled ? true : undefined"
      @change="onChange"
      class="peer"
    />
    <label
      class="bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover) inline-flex items-center px-2 py-0.5 text-xs font-mono border rounded transition-colors duration-200 peer-focus:ring-2 peer-focus:ring-fg border-none peer-checked:(bg-fg text-bg border-fg hover:(text-text-bg/50)) peer-disabled:(opacity-50 pointer-events-none)"
      :htmlFor="internalId"
    >
      <slot />
    </label>
  </div>
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
