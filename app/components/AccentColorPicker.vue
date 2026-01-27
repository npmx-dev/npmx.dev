<script setup lang="ts">
import { ACCENT_COLORS, useAccentColor, type ColorId } from '~/composables/useAccentColor'

const { accentColorId, setAccentColor } = useAccentColor()

const popoverRef = ref<HTMLElement | null>(null)

function selectColor(id: ColorId) {
  setAccentColor(id)
  popoverRef.value?.hidePopover()
}

function clearColor() {
  setAccentColor(null)
  popoverRef.value?.hidePopover()
}
</script>

<template>
  <div class="flex items-center justify-between">
    <button
      v-for="color in ACCENT_COLORS"
      :key="color.id"
      type="button"
      role="option"
      :aria-selected="accentColorId === color.id"
      :aria-label="color.name"
      class="size-6 rounded-full transition-transform duration-150 hover:scale-110 focus-ring"
      :class="{
        'ring-2 ring-fg ring-offset-2 ring-offset-bg-subtle': accentColorId === color.id,
      }"
      :style="{ backgroundColor: color.value }"
      @click="selectColor(color.id)"
    />
    <button
      type="button"
      aria-label="Clear accent color"
      class="size-6 rounded-full transition-transform duration-150 hover:scale-110 focus-ring flex items-center justify-center bg-accent-fallback"
      @click="clearColor"
    >
      <span class="i-carbon-error size-4 text-bg" />
    </button>
  </div>
</template>
