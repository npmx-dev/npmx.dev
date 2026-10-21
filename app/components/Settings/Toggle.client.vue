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
  }>(),
  {
    justify: 'between',
    reverseOrder: false,
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
    class="grid items-center gap-1.5 py-1 -my-1 grid-cols-[auto_1fr_auto] cursor-pointer"
    :class="[justify === 'start' ? 'justify-start' : '']"
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
    <input
      switch
      type="checkbox"
      :id="id"
      v-model="checked"
      class="shrink-0 focus-visible:(outline-2 outline-accent outline-offset-2)"
      style="grid-area: toggle; justify-self: end; accent-color: var(--accent)"
    />
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>
