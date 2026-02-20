<script setup lang="ts">
import type { SelectBaseProps } from './Base.vue'

const SELECT_FIELD_SIZES = {
  sm: 'text-xs py-1.75 ps-2 pe-6 rounded-md',
  md: 'text-sm py-2.25 ps-3 pe-9 rounded-lg',
  lg: 'text-base py-4 ps-6 pe-15 rounded-xl',
}
const SELECT_FIELD_ICON_SIZES = {
  sm: 'inset-ie-2 size-[0.75rem]',
  md: 'inset-ie-3 size-[1rem]',
  lg: 'inset-ie-5 size-[1.5rem]',
}
const SELECT_FIELD_LABEL_SIZES = {
  sm: 'text-2xs',
  md: 'text-xs',
  lg: 'text-sm',
}

const model = defineModel<string | undefined>({ default: undefined })

export interface SelectFieldProps extends SelectBaseProps {
  items: { label: string; value: string; disabled?: boolean }[]
  size?: keyof typeof SELECT_FIELD_SIZES
  selectAttrs?: Omit<SelectBaseProps, 'size' | 'id'> &
    Record<string, string | number | boolean | undefined>
  label?: string
  labelAttrs?: Record<string, string | number | boolean | undefined>
  /** Visually hide label */
  hiddenLabel?: boolean
  id: string
  /** Render select full width */
  block?: boolean
}

const props = withDefaults(defineProps<SelectFieldProps>(), {
  size: 'md',
})
</script>

<template>
  <div class="group/select">
    <label
      v-if="label"
      :for="id"
      v-bind="labelAttrs"
      class="block mb-1 font-mono text-fg-subtle tracking-wide uppercase"
      :class="[hiddenLabel ? 'sr-only' : '', SELECT_FIELD_LABEL_SIZES[size]]"
      >{{ label }}</label
    >
    <div class="relative" :class="[block ? 'w-full' : 'w-fit']">
      <SelectBase
        :disabled="disabled"
        size="none"
        class="appearance-none group-hover/select:border-fg-muted"
        :class="[SELECT_FIELD_SIZES[size], block ? 'w-full' : 'w-fit']"
        v-model="model"
        v-bind="selectAttrs"
        :id="id"
      >
        <option
          v-for="item in items"
          :key="item.value"
          :value="item.value"
          :disabled="item.disabled"
        >
          {{ item.label }}
        </option>
      </SelectBase>
      <span
        aria-hidden="true"
        class="block i-lucide:chevron-down absolute top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none group-hover/select:text-fg group-focus-within/select:text-fg"
        :class="[SELECT_FIELD_ICON_SIZES[size]]"
      />
    </div>
  </div>
</template>
