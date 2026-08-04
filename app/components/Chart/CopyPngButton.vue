<script setup lang="ts">
// Custom entry for a vue-data-ui user options menu (via the #custom-menu-before
// slot): copies the chart's PNG export to the clipboard. See useCopyChartPng.
defineProps<{
  copied: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="vue-ui-user-options-button cursor-pointer"
    :title="$t('package.trends.copy_file', { fileType: 'PNG' })"
    :aria-label="$t('package.trends.copy_file', { fileType: 'PNG' })"
  >
    <span
      class="w-6 h-6"
      :class="copied ? 'i-lucide:check text-accent' : 'i-lucide:copy text-fg-subtle'"
      style="pointer-events: none"
      aria-hidden="true"
    />
  </button>
</template>
