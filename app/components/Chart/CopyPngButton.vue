<script setup lang="ts">
// Custom entry for a vue-data-ui user options menu (via the #custom-menu-before
// slot): copies the chart's PNG export to the clipboard. See useCopyChartPng.
//
// The library gives its own buttons a `button-info` hover label, but that style
// is scoped to its SFC and slot content never gets its scope id, so the label
// below re-creates it — including the mouseenter/mouseout toggle it uses — to
// match the rest of the menu.
defineProps<{
  copied: boolean
  copying: boolean
}>()

const showLabel = shallowRef(false)
</script>

<template>
  <button
    type="button"
    :aria-busy="copying"
    :aria-label="$t('package.trends.copy_file', { fileType: 'PNG' })"
    class="vue-ui-user-options-button !cursor-pointer"
    @mouseenter="showLabel = true"
    @mouseleave="showLabel = false"
    @focus="showLabel = true"
    @blur="showLabel = false"
  >
    <!-- Rasterising a large chart takes a moment, so the click needs feedback -->
    <span
      v-if="copying"
      class="i-svg-spinners:ring-resize w-6 h-6 text-fg-subtle"
      aria-hidden="true"
    />
    <span
      v-else
      class="w-6 h-6"
      :class="copied ? 'i-lucide:check text-accent' : 'i-lucide:copy text-fg-subtle'"
      aria-hidden="true"
    />
    <span class="button-info" :class="{ 'button-info-visible': showLabel }" aria-hidden="true">
      {{ $t('package.trends.copy_file', { fileType: 'PNG' }) }}
    </span>
  </button>
</template>

<style scoped>
/* Mirrors .button-info-right in vue-data-ui's UserOptions, whose menu sits on
   the right, so the label opens towards the chart */
.button-info {
  position: absolute;
  top: 50%;
  right: 100%;
  z-index: 2147483000;
  padding: 4px 12px;
  border-radius: 4px 0 0 4px;
  background: var(--bg);
  color: var(--fg);
  opacity: 0;
  pointer-events: none;
  transform: translateY(-50%);
}

.button-info-visible {
  opacity: 1;
  animation: show-button-info 0.2s ease-in forwards;
}

@keyframes show-button-info {
  from {
    opacity: 0;
    transform: translateY(-50%) scaleX(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .button-info-visible {
    animation: none;
  }
}
</style>
