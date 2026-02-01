<script setup lang="ts">
import type { ViewMode } from '#shared/types/preferences'

const viewMode = defineModel<ViewMode>({ default: 'cards' })
</script>

<template>
  <div
    class="inline-flex rounded-md border border-border p-0.5 bg-bg-subtle"
    role="group"
    :aria-label="$t('filters.view_mode.label')"
  >
    <button
      type="button"
      class="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
      :class="viewMode === 'cards' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
      :aria-pressed="viewMode === 'cards'"
      :aria-label="$t('filters.view_mode.cards')"
      @click="viewMode = 'cards'"
    >
      <span class="i-carbon-horizontal-view w-4 h-4" aria-hidden="true" />
      <span class="sr-only">{{ $t('filters.view_mode.cards') }}</span>
    </button>
    <button
      type="button"
      class="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
      :class="viewMode === 'table' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
      :aria-pressed="viewMode === 'table'"
      :aria-label="$t('filters.view_mode.table')"
      @click="viewMode = 'table'"
    >
      <span class="i-carbon-table-split w-4 h-4" aria-hidden="true" />
      <span class="sr-only">{{ $t('filters.view_mode.table') }}</span>
    </button>
  </div>
</template>
