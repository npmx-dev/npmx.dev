<script setup lang="ts">
// Custom entry for a vue-data-ui user options menu (via the #custom-menu-before
// slot): copies the chart's PNG export to the clipboard. See useCopyChartPng.
defineProps<{
  copied: boolean
  copying: boolean
}>()
</script>

<template>
  <TooltipApp
    :text="$t('package.trends.copy_file', { fileType: 'PNG' })"
    position="left"
    strategy="fixed"
    :offset="0"
    :tooltip-attr="{
      class:
        'px-3! py-1! text-base! text-fg-subtle! bg-bg! border-0! rounded-s! rounded-e-none! shadow-none! whitespace-nowrap!',
    }"
  >
    <button
      type="button"
      :aria-busy="copying"
      :aria-label="$t('package.trends.copy_file', { fileType: 'PNG' })"
      class="vue-ui-user-options-button !cursor-pointer"
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
    </button>
  </TooltipApp>
</template>
