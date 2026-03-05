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
    class="grid items-center gap-1.5 py-1 -my-1 grid-cols-[auto_1fr_auto] cursor-pointer group"
    :class="[justify === 'start' ? 'justify-start' : '']"
    :style="
      props.reverseOrder
        ? 'grid-template-areas: \'toggle . label-text\''
        : 'grid-template-areas: \'label-text . toggle\''
    "
  >
    <template v-if="props.reverseOrder">
      <input
        role="switch"
        type="checkbox"
        :id="id"
        v-model="checked"
        class="toggle appearance-none h-6 w-11 rounded-full border border-fg relative shrink-0 bg-fg-subtle transition-colors duration-200 ease-in-out checked:bg-fg checked:border-fg hover:bg-fg-muted checked:hover:bg-fg-muted checked:hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 before:content-[''] before:absolute before:h-5 before:w-5 before:top-[1px] before:start-[1px] before:rounded-full before:bg-bg before:transition-transform before:duration-200 before:ease-in-out checked:before:translate-x-[20px] rtl:checked:before:-translate-x-[20px] after:content-[''] after:absolute after:h-3.5 after:w-3.5 after:top-[4px] after:start-[4px] after:i-lucide:check after:bg-fg after:opacity-0 checked:after:opacity-100 after:transition-all after:duration-200 after:ease-in-out checked:after:translate-x-[20px] rtl:checked:after:-translate-x-[20px]"
        style="grid-area: toggle"
      />
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
    </template>
    <template v-else>
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
        role="switch"
        type="checkbox"
        :id="id"
        v-model="checked"
        class="toggle appearance-none h-6 w-11 rounded-full border border-fg relative shrink-0 bg-fg-subtle transition-colors duration-200 ease-in-out checked:bg-fg checked:border-fg hover:bg-fg-muted checked:hover:bg-fg-muted checked:hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 before:content-[''] before:absolute before:h-5 before:w-5 before:top-[1px] before:start-[1px] before:rounded-full before:bg-bg before:transition-transform before:duration-200 before:ease-in-out checked:before:translate-x-[20px] rtl:checked:before:-translate-x-[20px] after:content-[''] after:absolute after:h-3.5 after:w-3.5 after:top-[4px] after:start-[4px] after:i-lucide:check after:bg-fg after:opacity-0 checked:after:opacity-100 after:transition-all after:duration-200 after:ease-in-out checked:after:translate-x-[20px] rtl:checked:after:-translate-x-[20px]"
        style="grid-area: toggle; justify-self: end"
      />
    </template>
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>

<style scoped>
/* Support forced colors */
@media (forced-colors: active) {
  .toggle {
    background: Canvas;
    border-color: CanvasText;
  }

  .toggle:checked {
    background: Highlight;
    border-color: CanvasText;
  }

  .toggle::before {
    background-color: CanvasText;
  }

  .toggle:checked::before {
    background-color: Canvas;
  }

  .toggle::after {
    background-color: Highlight;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toggle,
  .toggle::before,
  .toggle::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
