<script setup lang="ts">
import TooltipApp from '~/components/Tooltip/App.vue'

const props = withDefaults(
  defineProps<{
    label: string
    description?: string
    justify?: 'between' | 'start'
    tooltip?: string
    tooltipPosition?: 'top' | 'bottom' | 'left' | 'right'
    tooltipTo?: string
    tooltipOffset?: number
    reverseOrder?: boolean
    disabled?: boolean
  }>(),
  {
    justify: 'between',
    reverseOrder: false,
    disabled: false,
  },
)

const checked = defineModel<boolean>({
  required: true,
})
const id = useId()
</script>

<template>
  <label
    :for="id"
    class="grid items-center gap-1.5 py-1 -my-1 grid-cols-[auto_1fr_auto]"
    :class="[
      justify === 'start' ? 'justify-start' : '',
      props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    ]"
    :style="
      props.reverseOrder
        ? 'grid-template-areas: \'toggle . label-text\''
        : 'grid-template-areas: \'label-text . toggle\''
    "
  >
    <TooltipApp
      v-if="tooltip && label"
      :text="tooltip"
      :position="tooltipPosition ?? 'top'"
      :to="tooltipTo"
      :offset="tooltipOffset"
    >
      <span class="text-sm text-fg font-medium text-start" style="grid-area: label-text">
        {{ label }}
      </span>
    </TooltipApp>
    <span
      v-else-if="label"
      class="text-sm text-fg font-medium text-start"
      style="grid-area: label-text"
    >
      {{ label }}
    </span>
    <SettingsSwitch
      :id="id"
      :disabled="props.disabled"
      v-model="checked"
      style="grid-area: toggle; justify-self: end"
    />
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>
