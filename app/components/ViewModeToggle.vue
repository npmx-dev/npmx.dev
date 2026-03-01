<script setup lang="ts">
import type { ViewMode } from '#shared/types/preferences'

const viewMode = defineModel<ViewMode>({ default: 'cards' })
</script>

<template>
  <div
    class="inline-flex rounded-md border border-border p-0.5 bg-bg-muted"
    role="group"
    :aria-label="$t('filters.view_mode.label')"
  >
    <button
      type="button"
      class="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-sm border transition-colors duration-200 focus-ring-accent"
      :class="
        viewMode === 'cards'
          ? 'bg-bg-subtle text-fg border-fg-subtle'
          : 'text-fg-muted hover:text-fg border-transparent'
      "
      :aria-pressed="viewMode === 'cards'"
      :aria-label="$t('filters.view_mode.cards')"
      @click="viewMode = 'cards'"
    >
      <span class="i-lucide:rows-2 w-4 h-4" aria-hidden="true" />
      <span class="sr-only">{{ $t('filters.view_mode.cards') }}</span>
    </button>
    <button
      type="button"
      class="inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-sm border transition-colors duration-200 focus-ring-accent"
      :class="
        viewMode === 'table'
          ? 'bg-bg-subtle  text-fg border-fg-subtle'
          : 'text-fg-muted hover:text-fg border-transparent'
      "
      :aria-pressed="viewMode === 'table'"
      :aria-label="$t('filters.view_mode.table')"
      @click="viewMode = 'table'"
    >
      <span class="i-lucide:table w-4 h-4" aria-hidden="true" />
      <span class="sr-only">{{ $t('filters.view_mode.table') }}</span>
    </button>
  </div>
</template>
