<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types/npm-registry'
import type {
  ColumnConfig,
  ColumnId,
  SortKey,
  SortOption,
  StructuredFilters,
} from '#shared/types/preferences'
import { buildSortOption, parseSortOption, toggleDirection } from '#shared/types/preferences'

const props = defineProps<{
  results: NpmSearchResult[]
  columns: ColumnConfig[]
  filters?: StructuredFilters
  isLoading?: boolean
}>()

const { t } = useI18n()

const sortOption = defineModel<SortOption>('sortOption')

const emit = defineEmits<{
  clickKeyword: [keyword: string]
}>()

function isColumnVisible(id: string): boolean {
  return props.columns.find(c => c.id === id)?.visible ?? false
}

function isSortable(id: string): boolean {
  return props.columns.find(c => c.id === id)?.sortable ?? false
}

// Map column id to sort key
const columnToSortKey: Record<string, SortKey> = {
  name: 'name',
  downloads: 'downloads-week',
  updated: 'updated',
  qualityScore: 'quality',
  popularityScore: 'popularity',
  maintenanceScore: 'maintenance',
  combinedScore: 'score',
}

// Default direction for each column
const columnDefaultDirection: Record<string, 'asc' | 'desc'> = {
  name: 'asc',
  downloads: 'desc',
  updated: 'desc',
  qualityScore: 'desc',
  popularityScore: 'desc',
  maintenanceScore: 'desc',
  combinedScore: 'desc',
}

function isColumnSorted(id: string): boolean {
  const option = sortOption.value
  if (!option) return false
  const { key } = parseSortOption(option)
  return key === columnToSortKey[id]
}

function getSortDirection(id: string): 'asc' | 'desc' | null {
  const option = sortOption.value
  if (!option) return null
  if (!isColumnSorted(id)) return null
  const { direction } = parseSortOption(option)
  return direction
}

function toggleSort(id: string) {
  if (!isSortable(id)) return

  const sortKey = columnToSortKey[id]
  if (!sortKey) return

  const isSorted = isColumnSorted(id)

  if (!isSorted) {
    // First click - use default direction
    const defaultDir = columnDefaultDirection[id] ?? 'desc'
    sortOption.value = buildSortOption(sortKey, defaultDir)
  } else {
    // Toggle direction
    const currentDir = getSortDirection(id) ?? 'desc'
    sortOption.value = buildSortOption(sortKey, toggleDirection(currentDir))
  }
}

// Map column IDs to i18n keys
const columnLabels = computed(() => ({
  name: t('filters.columns.name'),
  version: t('filters.columns.version'),
  description: t('filters.columns.description'),
  downloads: t('filters.columns.downloads'),
  updated: t('filters.columns.published'),
  maintainers: t('filters.columns.maintainers'),
  keywords: t('filters.columns.keywords'),
  qualityScore: t('filters.columns.quality_score'),
  popularityScore: t('filters.columns.popularity_score'),
  maintenanceScore: t('filters.columns.maintenance_score'),
  combinedScore: t('filters.columns.combined_score'),
  security: t('filters.columns.security'),
}))

function getColumnLabel(id: ColumnId): string {
  return columnLabels.value[id]
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-start">
      <thead class="border-b border-border">
        <tr>
          <!-- Name (always visible) -->
          <th
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none"
            :class="{
              'cursor-pointer hover:text-fg transition-colors duration-200': isSortable('name'),
            }"
            :aria-sort="
              isColumnSorted('name')
                ? getSortDirection('name') === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
            :tabindex="isSortable('name') ? 0 : undefined"
            role="columnheader"
            @click="toggleSort('name')"
            @keydown.enter="toggleSort('name')"
            @keydown.space.prevent="toggleSort('name')"
          >
            <span class="inline-flex items-center gap-1">
              {{ getColumnLabel('name') }}
              <template v-if="isSortable('name')">
                <span
                  v-if="isColumnSorted('name')"
                  class="i-carbon-caret-down w-3 h-3"
                  :class="getSortDirection('name') === 'asc' ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
                <span v-else class="i-carbon-caret-sort w-3 h-3 opacity-30" aria-hidden="true" />
              </template>
            </span>
          </th>

          <th
            v-if="isColumnVisible('version')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('version') }}
          </th>

          <th
            v-if="isColumnVisible('description')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('description') }}
          </th>

          <th
            v-if="isColumnVisible('downloads')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none"
            :class="{
              'cursor-pointer hover:text-fg transition-colors duration-200':
                isSortable('downloads'),
            }"
            :aria-sort="
              isColumnSorted('downloads')
                ? getSortDirection('downloads') === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
            :tabindex="isSortable('downloads') ? 0 : undefined"
            role="columnheader"
            @click="toggleSort('downloads')"
            @keydown.enter="toggleSort('downloads')"
            @keydown.space.prevent="toggleSort('downloads')"
          >
            <span class="inline-flex items-center gap-1 justify-end">
              {{ getColumnLabel('downloads') }}
              <template v-if="isSortable('downloads')">
                <span
                  v-if="isColumnSorted('downloads')"
                  class="i-carbon-caret-down w-3 h-3"
                  :class="getSortDirection('downloads') === 'asc' ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
                <span v-else class="i-carbon-caret-sort w-3 h-3 opacity-30" aria-hidden="true" />
              </template>
            </span>
          </th>

          <th
            v-if="isColumnVisible('updated')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none"
            :class="{
              'cursor-pointer hover:text-fg transition-colors duration-200': isSortable('updated'),
            }"
            :aria-sort="
              isColumnSorted('updated')
                ? getSortDirection('updated') === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
            :tabindex="isSortable('updated') ? 0 : undefined"
            role="columnheader"
            @click="toggleSort('updated')"
            @keydown.enter="toggleSort('updated')"
            @keydown.space.prevent="toggleSort('updated')"
          >
            <span class="inline-flex items-center gap-1">
              {{ getColumnLabel('updated') }}
              <template v-if="isSortable('updated')">
                <span
                  v-if="isColumnSorted('updated')"
                  class="i-carbon-caret-down w-3 h-3"
                  :class="getSortDirection('updated') === 'asc' ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
                <span v-else class="i-carbon-caret-sort w-3 h-3 opacity-30" aria-hidden="true" />
              </template>
            </span>
          </th>

          <th
            v-if="isColumnVisible('maintainers')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('maintainers') }}
          </th>

          <th
            v-if="isColumnVisible('keywords')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('keywords') }}
          </th>

          <th
            v-if="isColumnVisible('qualityScore')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('qualityScore') }}
          </th>

          <th
            v-if="isColumnVisible('popularityScore')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('popularityScore') }}
          </th>

          <th
            v-if="isColumnVisible('maintenanceScore')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('maintenanceScore') }}
          </th>

          <th
            v-if="isColumnVisible('combinedScore')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('combinedScore') }}
          </th>

          <th
            v-if="isColumnVisible('security')"
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none text-end"
          >
            {{ getColumnLabel('security') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <!-- Loading skeleton rows -->
        <template v-if="isLoading && results.length === 0">
          <tr v-for="i in 5" :key="`skeleton-${i}`" class="border-b border-border">
            <td class="py-3 px-3">
              <div class="h-4 w-32 bg-bg-muted rounded animate-pulse" />
            </td>
            <td v-if="isColumnVisible('version')" class="py-3 px-3">
              <div class="h-4 w-12 bg-bg-muted rounded animate-pulse" />
            </td>
            <td v-if="isColumnVisible('description')" class="py-3 px-3">
              <div class="h-4 w-48 bg-bg-muted rounded animate-pulse" />
            </td>
            <td v-if="isColumnVisible('downloads')" class="py-3 px-3">
              <div class="h-4 w-16 bg-bg-muted rounded animate-pulse ms-auto" />
            </td>
            <td v-if="isColumnVisible('updated')" class="py-3 px-3">
              <div class="h-4 w-20 bg-bg-muted rounded animate-pulse ms-auto" />
            </td>
            <td v-if="isColumnVisible('maintainers')" class="py-3 px-3">
              <div class="h-4 w-24 bg-bg-muted rounded animate-pulse ms-auto" />
            </td>
            <td v-if="isColumnVisible('keywords')" class="py-3 px-3">
              <div class="h-4 w-32 bg-bg-muted rounded animate-pulse ms-auto" />
            </td>
          </tr>
        </template>

        <!-- Actual data rows -->
        <template v-else>
          <PackageTableRow
            v-for="(result, index) in results"
            :key="result.package.name"
            :result="result"
            :columns="columns"
            :index="index"
            :filters="filters"
            @click-keyword="emit('clickKeyword', $event)"
          />
        </template>
      </tbody>
    </table>

    <!-- Empty state (only when not loading) -->
    <div
      v-if="results.length === 0 && !isLoading"
      class="py-12 text-center text-fg-subtle font-mono text-sm"
    >
      {{ $t('filters.table.no_packages') }}
    </div>
  </div>
</template>
