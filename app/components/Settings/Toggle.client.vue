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
    class="grid items-center gap-4 py-1 -my-1 grid-cols-[auto_1fr_auto]"
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
        :id
        v-model="checked"
        class="toggle appearance-none h-6 w-11 rounded-full border border-fg relative shrink-0 bg-fg-subtle checked:bg-fg checked:border-fg focus-visible:(outline-2 outline-fg outline-offset-2) before:content-[''] before:absolute before:h-5 before:w-5 before:top-1px before:rounded-full before:bg-bg"
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
        :id
        v-model="checked"
        class="toggle appearance-none h-6 w-11 rounded-full border border-fg relative shrink-0 bg-fg-subtle checked:bg-fg checked:border-fg focus-visible:(outline-2 outline-fg outline-offset-2) before:content-[''] before:absolute before:h-5 before:w-5 before:top-1px before:rounded-full before:bg-bg"
        style="grid-area: toggle; justify-self: end"
      />
    </template>
  </label>
  <p v-if="description" class="text-sm text-fg-muted mt-2">
    {{ description }}
  </p>
</template>

<style scoped>
/* Thumb position: logical property for RTL support */
.toggle::before {
  inset-inline-start: 1px;
}

/* Track transition */
.toggle {
  transition:
    background-color 200ms ease-in-out,
    border-color 100ms ease-in-out;
}

.toggle::before {
  transition:
    background-color 200ms ease-in-out,
    translate 200ms ease-in-out;
}

/* Hover states */
.toggle:hover:not(:checked) {
  background: var(--fg-muted);
}

.toggle:checked:hover {
  background: var(--fg-muted);
  border-color: var(--fg-muted);
}

/* RTL-aware checked thumb position */
:dir(ltr) .toggle:checked::before {
  translate: 20px;
}

:dir(rtl) .toggle:checked::before {
  translate: -20px;
}

@media (prefers-reduced-motion: reduce) {
  .toggle,
  .toggle::before {
    transition: none;
  }
}

/* Support forced colors */
@media (forced-colors: active) {
  label > span {
    background: Canvas;
    color: Highlight;
    forced-color-adjust: none;
  }

  label:has(.toggle:checked) > span {
    background: Highlight;
    color: Canvas;
  }

  .toggle::before {
    forced-color-adjust: none;
    background-color: Highlight;
  }

  .toggle,
  .toggle:hover {
    background: Canvas;
    border-color: CanvasText;
  }

  .toggle:checked,
  .toggle:checked:hover {
    background: Highlight;
    border-color: CanvasText;
  }

  .toggle:checked::before {
    background: Canvas;
  }
}
</style>
