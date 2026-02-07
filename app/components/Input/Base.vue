<script setup lang="ts">
import { noCorrect } from '~/utils/input'

const props = withDefaults(
  defineProps<{
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
    class="w-full leading-none bg-bg-subtle border border-border font-mono text-fg placeholder:text-fg-subtle transition-[border-color,outline-color] duration-300 hover:border-fg-subtle outline-2 outline-transparent outline-offset-2 focus:border-accent focus-visible:outline-accent/70 disabled:(opacity-50 cursor-not-allowed)"
    :class="{
      'text-xs px-2 py-1.25 h-8 rounded-md': size === 'small',
      'text-sm px-3 py-2.5 h-10 rounded-lg': size === 'medium',
      'text-base px-6 py-3.5 h-14 rounded-xl': size === 'large',
    }"
  />
</template>
