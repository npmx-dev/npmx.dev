<script setup lang="ts">
import { useAccentColor } from '~/composables/useSettings'

const { accentColors, selectedAccentColor, setAccentColor } = useAccentColor()

onPrehydrate(el => {
  const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const defaultId = 'sky'
  const id = settings.accentColorId
  if (id) {
    const input = el.querySelector<HTMLInputElement>(`input[value="${id}"]`)
    if (input) {
      input.checked = true
      input.setAttribute('checked', '')
    }
    // Remove checked from the server-default (clear button, value="")
    if (id !== defaultId) {
      const clearInput = el.querySelector<HTMLInputElement>(`input[value="${defaultId}"]`)
      if (clearInput) {
        clearInput.checked = false
        clearInput.removeAttribute('checked')
      }
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
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 has-[:checked]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle) has-[:focus-visible]:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle)"
      :class="color.id === 'neutral' ? 'flex items-center justify-center bg-fg' : ''"
      :style="{ backgroundColor: `var(--swatch-${color.id})` }"
    >
      <input
        type="radio"
        name="accent-color"
        class="sr-only"
        :value="color.id"
        :checked="selectedAccentColor === color.id || (!selectedAccentColor && color.id === 'sky')"
        :aria-label="color.id === 'neutral' ? $t('settings.clear_accent') : color.name"
        @change="setAccentColor(color.id)"
      />
      <span v-if="color.id === 'neutral'" class="i-lucide:ban size-4 text-bg" aria-hidden="true" />
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
