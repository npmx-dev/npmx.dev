<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    id?: string
    disabled?: boolean
    ariaLabel?: string
  }>(),
  {
    disabled: false,
  },
)

const checked = defineModel<boolean>({
  required: true,
})
</script>

<template>
  <input
    role="switch"
    type="checkbox"
    :id="props.id"
    :disabled="props.disabled"
    :aria-label="props.ariaLabel"
    v-model="checked"
    class="toggle appearance-none h-6 w-11 rounded-full border border-fg relative shrink-0 bg-fg/50 transition-colors duration-200 ease-in-out checked:bg-fg [@media(hover:hover)]:hover:bg-fg/60 [@media(hover:hover)]:checked:hover:(bg-fg/80 after:opacity-50) focus-visible:(outline-2 outline-accent outline-offset-2) before:(content-[''] absolute h-5 w-5 top-px start-px rounded-full bg-bg transition-transform duration-200 ease-in-out) checked:before:translate-x-[20px] rtl:checked:before:-translate-x-[20px] after:(content-[''] absolute h-3.5 w-3.5 top-[4px] start-[4px] i-lucide:check bg-fg opacity-0 transition-all duration-200 ease-in-out) checked:after:opacity-100 checked:after:translate-x-[20px] rtl:checked:after:-translate-x-[20px]"
  />
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
