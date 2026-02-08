<script setup lang="ts">
import { useAccentColor } from '~/composables/useSettings'

const { accentColors, selectedAccentColor, setAccentColor } = useAccentColor()

onPrehydrate(el => {
  const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const id = settings.accentColorId
  if (id) {
    const input = el.querySelector<HTMLInputElement>(`input[value="${id}"]`)
    if (input) {
      input.checked = true
      input.setAttribute('checked', '')
    }
    // Remove checked from the server-default (clear button, value="")
    const clearInput = el.querySelector<HTMLInputElement>('input[value=""]')
    if (clearInput) {
      clearInput.checked = false
      clearInput.removeAttribute('checked')
    }
  }
})
</script>

<template>
  <fieldset
    class="flex items-center gap-4 has-[input:focus-visible]:(outline-solid outline-accent/70 outline-offset-4) rounded-xl w-fit"
  >
    <legend class="sr-only">{{ $t('settings.accent_colors') }}</legend>
    <label
      v-for="color in accentColors"
      :key="color.id"
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 cursor-pointer has-[:checked]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle) has-[:focus-visible]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle)"
      :style="{ backgroundColor: `var(--swatch-${color.id})` }"
    >
      <input
        type="radio"
        name="accent-color"
        class="sr-only"
        :value="color.id"
        :checked="selectedAccentColor === color.id"
        :aria-label="color.name"
        @change="setAccentColor(color.id)"
      />
    </label>
    <label
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 cursor-pointer has-[:checked]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle) has-[:focus-visible]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle) flex items-center justify-center bg-fg"
    >
      <input
        type="radio"
        name="accent-color"
        class="sr-only"
        value=""
        :checked="selectedAccentColor === null"
        :aria-label="$t('settings.clear_accent')"
        @change="setAccentColor(null)"
      />
      <span class="i-carbon-error size-4 text-bg" aria-hidden="true" />
    </label>
  </fieldset>
</template>

<style scoped>
@media (forced-colors: active) {
  /* keep accent radio swatches visible in forced colors. */
  label {
    forced-color-adjust: none;
    border: 1px solid CanvasText;

    &:has(> input:checked) {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  }
}
</style>
