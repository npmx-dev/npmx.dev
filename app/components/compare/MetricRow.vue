<script setup lang="ts">
import type { MetricValue, DiffResult } from '#shared/types'

const props = defineProps<{
  /** Metric label */
  label: string
  /** Description/tooltip for the metric */
  description?: string
  /** Values for each column */
  values: (MetricValue | null | undefined)[]
  /** Diff results between adjacent columns (for release comparison) */
  diffs?: (DiffResult | null | undefined)[]
  /** Whether this row is loading */
  loading?: boolean
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
function getBarWidth(value: MetricValue | null | undefined): number {
  if (!isNumeric.value || !maxValue.value || !value || typeof value.raw !== 'number') return 0
  return (value.raw / maxValue.value) * 100
}

function getStatusClass(status?: MetricValue['status']): string {
  switch (status) {
    case 'good':
      return 'text-emerald-400'
    case 'info':
      return 'text-blue-400'
    case 'warning':
      return 'text-amber-400'
    case 'bad':
      return 'text-red-400'
    default:
      return 'text-fg'
  }
}

function getDiffClass(diff?: DiffResult | null): string {
  if (!diff) return ''
  if (diff.favorable === true) return 'text-emerald-400'
  if (diff.favorable === false) return 'text-red-400'
  return 'text-fg-muted'
}

function getDiffIcon(diff?: DiffResult | null): string {
  if (!diff) return ''
  switch (diff.direction) {
    case 'increase':
      return 'i-carbon-arrow-up'
    case 'decrease':
      return 'i-carbon-arrow-down'
    case 'changed':
      return 'i-carbon-arrows-horizontal'
    default:
      return ''
  }
}
</script>

<template>
  <div class="contents">
    <!-- Label cell -->
    <div
      class="comparison-label flex items-center gap-1.5 px-4 py-3 border-b border-border"
      :title="description"
    >
      <span class="text-xs text-fg-muted uppercase tracking-wider">{{ label }}</span>
      <span
        v-if="description"
        class="i-carbon-information w-3 h-3 text-fg-subtle"
        aria-hidden="true"
      />
    </div>

    <!-- Value cells -->
    <div
      v-for="(value, index) in values"
      :key="index"
      class="comparison-cell relative flex flex-col items-end justify-center gap-1 px-4 py-3 border-b border-border"
    >
      <!-- Background bar for numeric values -->
      <div
        v-if="showBar && value && getBarWidth(value) > 0"
        class="absolute inset-y-1 left-1 bg-fg/5 rounded-sm transition-all duration-300"
        :style="{ width: `calc(${getBarWidth(value)}% - 8px)` }"
        aria-hidden="true"
      />

      <!-- Loading state -->
      <template v-if="loading">
        <span
          class="i-carbon-circle-dash w-4 h-4 text-fg-subtle motion-safe:animate-spin"
          aria-hidden="true"
        />
      </template>

      <!-- No data -->
      <template v-else-if="!value">
        <span class="text-fg-subtle text-sm">-</span>
      </template>

      <!-- Value display -->
      <template v-else>
        <span class="relative font-mono text-sm tabular-nums" :class="getStatusClass(value.status)">
          <!-- Date values use DateTime component for i18n and user settings -->
          <DateTime v-if="value.type === 'date'" :datetime="value.display" date-style="medium" />
          <template v-else>{{ value.display }}</template>
        </span>

        <!-- Diff indicator (if provided) -->
        <div
          v-if="diffs && diffs[index] && diffs[index]?.direction !== 'same'"
          class="relative flex items-center gap-1 text-xs tabular-nums"
          :class="getDiffClass(diffs[index])"
        >
          <span
            v-if="getDiffIcon(diffs[index])"
            class="w-3 h-3"
            :class="getDiffIcon(diffs[index])"
            aria-hidden="true"
          />
          <span>{{ diffs[index]?.display }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
