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
  /** Package headers for display */
  headers: string[]
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

function getStatusClass(status?: FacetValue['status']): string {
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

// Check if a specific cell is loading
function isCellLoading(index: number): boolean {
  return props.facetLoading || (props.columnLoading?.[index] ?? false)
}

// Get short package name (without version) for mobile display
function getShortName(header: string): string {
  const atIndex = header.lastIndexOf('@')
  if (atIndex > 0) {
    return header.substring(0, atIndex)
  }
  return header
}
</script>

<template>
  <div class="border border-border rounded-lg overflow-hidden">
    <!-- Facet header -->
    <div class="flex items-center gap-1.5 px-3 py-2 bg-bg-subtle border-b border-border">
      <span class="text-xs text-fg-muted uppercase tracking-wider font-medium">{{ label }}</span>
      <span
        v-if="description"
        class="i-carbon:information w-3 h-3 text-fg-subtle"
        :title="description"
        aria-hidden="true"
      />
    </div>

    <!-- Package values -->
    <div class="divide-y divide-border">
      <div
        v-for="(value, index) in values"
        :key="index"
        class="relative flex items-center justify-between gap-2 px-3 py-2"
      >
        <!-- Background bar for numeric values -->
        <div
          v-if="showBar && value && getBarWidth(value) > 0"
          class="absolute inset-y-0 inset-is-0 bg-fg/5 transition-all duration-300"
          :style="{ width: `${getBarWidth(value)}%` }"
          aria-hidden="true"
        />

        <!-- Package name -->
        <span
          class="relative font-mono text-xs text-fg-muted truncate flex-shrink min-w-0"
          :title="headers[index]"
        >
          {{ getShortName(headers[index] ?? '') }}
        </span>

        <!-- Value -->
        <span class="relative flex-shrink-0">
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
            <span class="font-mono text-sm tabular-nums" :class="getStatusClass(value.status)">
              <!-- Date values use DateTime component for i18n and user settings -->
              <DateTime
                v-if="value.type === 'date'"
                :datetime="value.display"
                date-style="medium"
              />
              <template v-else>{{ value.display }}</template>
            </span>
          </template>
        </span>
      </div>
    </div>
  </div>
</template>
