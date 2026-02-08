<script setup lang="ts">
import { noCorrect } from '~/utils/input'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    modelValue?: string
    size?: 'small' | 'medium' | 'large'
    noCorrect?: boolean
  }>(),
  {
    modelValue: '',
    size: 'medium',
    noCorrect: true,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'focus': [event: FocusEvent]
  'blur': [event: FocusEvent]
}>()

const el = useTemplateRef('el')

const model = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
})

defineExpose({
  focus: () => el.value?.focus(),
  blur: () => el.value?.blur(),
  getBoundingClientRect: () => el.value?.getBoundingClientRect(),
})
</script>

<template>
  <input
    ref="el"
    v-model="model"
    v-bind="props.noCorrect ? noCorrect : undefined"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
    class="bg-bg-subtle border border-border font-mono text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 hover:border-fg-subtle outline-2 outline-transparent outline-offset-2 focus:border-accent focus-visible:outline-accent/70 disabled:(opacity-50 cursor-not-allowed)"
    :class="{
      'text-xs leading-[1.2] px-2 py-2 rounded-md': size === 'small',
      'text-sm leading-none px-3 py-2.5 rounded-lg': size === 'medium',
      'text-base leading-none px-6 py-3.5 h-14 rounded-xl': size === 'large',
    }"
    :disabled="
      /** Catching Vue render-bug of invalid `disabled=false` attribute in the final HTML */
      disabled ? true : undefined
    "
  />
</template>
