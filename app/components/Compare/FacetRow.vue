<script setup lang="ts">
import type { FacetValue } from '#shared/types'

const props = defineProps<{
  /** Facet label */
  label: string
  /** Description/tooltip for the facet */
  description?: string
  /** Values for each column */
  values: (FacetValue | null | undefined)[]
  /** Whether this facet is loading (e.g., install size) */
  facetLoading?: boolean
  /** Whether each column is loading (array matching values) */
  columnLoading?: boolean[]
  /** Whether to show the proportional bar (defaults to true for numeric values) */
  bar?: boolean
}>()

// Check if all values are numeric (for bar visualization)
const isNumeric = computed(() => {
  return props.values.every(v => v === null || v === undefined || typeof v.raw === 'number')
})

// Show bar if explicitly enabled, or if not specified and values are numeric
const showBar = computed(() => {
  return props.bar ?? isNumeric.value
})

// Get max value for bar width calculation
const maxValue = computed(() => {
  if (!isNumeric.value) return 0
  return Math.max(...props.values.map(v => (typeof v?.raw === 'number' ? v.raw : 0)))
})

// Calculate bar width percentage for a value
function getBarWidth(value: FacetValue | null | undefined): number {
  if (!isNumeric.value || !maxValue.value || !value || typeof value.raw !== 'number') return 0
  return (value.raw / maxValue.value) * 100
}

function getStatusClass(status?: FacetValue['status'], hasBar = false): string {
  // When there's a bar, only apply text color, not background
  if (hasBar) {
    switch (status) {
      case 'muted':
        return 'text-fg-subtle'
      default:
        return 'text-fg'
    }
  }

  // Original behavior when no bar
  switch (status) {
    case 'good':
      return 'bg-emerald-400/20 px-3 py-0.5 rounded-xl'
    case 'info':
      return 'bg-blue-400/20 px-3 py-0.5 rounded-xl'
    case 'warning':
      return 'bg-amber-400/20 px-3 py-0.5 rounded-xl'
    case 'bad':
      return 'bg-red-400/20 px-3 py-0.5 rounded-xl'
    case 'muted':
      return 'text-fg-subtle'
    default:
      return 'text-fg'
  }
}

function getStatusBarClass(status?: FacetValue['status']): string {
  switch (status) {
    case 'good':
      return 'bg-emerald-500/20'
    case 'info':
      return 'bg-blue-500/20'
    case 'warning':
      return 'bg-amber-500/20'
    case 'bad':
      return 'bg-red-500/20'
    default:
      return 'bg-fg/5'
  }
}

// Check if a specific cell is loading
function isCellLoading(index: number): boolean {
  return props.facetLoading || (props.columnLoading?.[index] ?? false)
}
</script>

<template>
  <div class="contents">
    <!-- Label cell -->
    <div class="comparison-label flex items-center gap-1.5 px-4 py-3 border-b border-border">
      <span class="text-xs text-fg-muted uppercase tracking-wider">{{ label }}</span>
      <TooltipApp v-if="description" :text="description" position="top">
        <span class="i-carbon:information w-3 h-3 text-fg-subtle cursor-help" aria-hidden="true" />
      </TooltipApp>
    </div>

    <!-- Value cells -->
    <div
      v-for="(value, index) in values"
      :key="index"
      class="comparison-cell relative flex items-center justify-center px-4 py-3 border-b border-border"
    >
      <!-- Background bar for numeric values -->
      <div
        v-if="showBar && value && getBarWidth(value) > 0"
        class="absolute inset-y-1 inset-is-1 rounded-sm transition-all duration-300"
        :class="getStatusBarClass(value.status)"
        :style="{ width: `calc(${getBarWidth(value)}% - 8px)` }"
        aria-hidden="true"
      />

      <!-- Loading state -->
      <template v-if="isCellLoading(index)">
        <span
          class="i-carbon:circle-dash w-4 h-4 text-fg-subtle motion-safe:animate-spin"
          aria-hidden="true"
        />
      </template>

      <!-- No data -->
      <template v-else-if="!value">
        <span class="text-fg-subtle text-sm">-</span>
      </template>

      <!-- Value display -->
      <template v-else>
        <TooltipApp v-if="value.tooltip" :text="value.tooltip" position="top">
          <span
            class="relative font-mono text-sm text-center tabular-nums cursor-help"
            :class="getStatusClass(value.status, showBar && getBarWidth(value) > 0)"
            :data-status="value.status"
          >
            <!-- Date values use DateTime component for i18n and user settings -->
            <DateTime v-if="value.type === 'date'" :datetime="value.display" date-style="medium" />
            <template v-else>{{ value.display }}</template>
          </span>
        </TooltipApp>
        <span
          v-else
          class="relative font-mono text-sm text-center tabular-nums"
          :class="getStatusClass(value.status, showBar && getBarWidth(value) > 0)"
          :data-status="value.status"
        >
          <!-- Date values use DateTime component for i18n and user settings -->
          <DateTime v-if="value.type === 'date'" :datetime="value.display" date-style="medium" />
          <template v-else>
            <span dir="ltr">{{ value.display }}</span>
          </template>
        </span>
      </template>
    </div>
  </div>
</template>
