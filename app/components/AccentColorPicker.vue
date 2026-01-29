<script setup lang="ts">
import { useAccentColor } from '~/composables/useSettings'

const { accentColors, selectedAccentColor, setAccentColor } = useAccentColor()
</script>

<template>
  <div role="listbox" aria-label="Accent colors" class="flex items-center gap-4">
    <button
      v-for="color in accentColors"
      :key="color.id"
      type="button"
      role="option"
      :aria-selected="selectedAccentColor === color.id"
      :aria-label="color.name"
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 focus-ring aria-selected:(ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle)"
      :style="{ backgroundColor: color.value }"
      @click="setAccentColor(color.id)"
    />
    <button
      type="button"
      aria-label="Clear accent color"
      class="size-6 rounded-full transition-transform duration-150 motion-safe:hover:scale-110 focus-ring flex items-center justify-center bg-accent-fallback"
      @click="setAccentColor(null)"
    >
      <span class="i-carbon-error size-4 text-bg" aria-hidden="true" />
    </button>
  </div>
</template>
