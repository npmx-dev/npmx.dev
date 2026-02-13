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
  <div>
    <input
      type="radio"
      :id="internalId"
      :value="props.value"
      :checked="checked"
      :disabled="props.disabled ? true : undefined"
      @change="onChange"
      class="peer sr-only"
    />
    <label
      class="bg-bg-muted text-fg-muted border-border hover:(text-fg border-border-hover) inline-flex items-center font-mono border rounded transition-colors duration-200 peer-focus-visible:(outline-2 outline-accent/70 outline-offset-2) border-none peer-checked:(bg-fg text-bg border-fg hover:(text-text-bg/50)) peer-disabled:(opacity-50 pointer-events-none) before:content-[''] before:inline-block before:w-3 before:h-3 before:rounded-full before:bg-transparent before:border before:border-current before:me-2 peer-checked:before:bg-accent peer-checked:before:border-transparent peer-disabled:before:border-current/50 before:transition-colors before:duration-200"
      :class="{
        'text-sm px-4 py-2': size === 'medium',
        'text-xs px-2 py-0.5': size === 'small',
      }"
      :htmlFor="internalId"
    >
      <slot />
    </label>
  </div>
</template>
