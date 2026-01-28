<script setup lang="ts">
import type { NpmSearchResult } from '~~/shared/types/npm-registry'
import type { ColumnConfig, SortKey, SortOption } from '~~/shared/types/preferences'
import { buildSortOption, parseSortOption, toggleDirection } from '~~/shared/types/preferences'

const props = defineProps<{
  results: NpmSearchResult[]
  columns: ColumnConfig[]
  sortOption?: SortOption
  selectedIndex?: number
  isLoading?: boolean
}>()

const emit = defineEmits<{
  'update:sortOption': [option: SortOption]
  'select': [index: number]
  'clickKeyword': [keyword: string]
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
  const option = props.sortOption
  if (!option) return false
  const { key } = parseSortOption(option)
  return key === columnToSortKey[id]
}

function getSortDirection(id: string): 'asc' | 'desc' | null {
  const option = props.sortOption
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
    emit('update:sortOption', buildSortOption(sortKey, defaultDir))
  } else {
    // Toggle direction
    const currentDir = getSortDirection(id) ?? 'desc'
    emit('update:sortOption', buildSortOption(sortKey, toggleDirection(currentDir)))
  }
}

const { t } = useI18n()

// Map column IDs to i18n keys
const columnLabelKey: Record<string, string> = {
  name: 'filters.columns.name',
  version: 'filters.columns.version',
  description: 'filters.columns.description',
  downloads: 'filters.columns.downloads',
  updated: 'filters.columns.updated',
  maintainers: 'filters.columns.maintainers',
  keywords: 'filters.columns.keywords',
  qualityScore: 'filters.columns.quality_score',
  popularityScore: 'filters.columns.popularity_score',
  maintenanceScore: 'filters.columns.maintenance_score',
  combinedScore: 'filters.columns.combined_score',
  security: 'filters.columns.security',
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left">
      <thead class="border-b border-border">
        <tr>
          <!-- Name (always visible) -->
          <th
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
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
            :role="isSortable('name') ? 'columnheader button' : 'columnheader'"
            @click="toggleSort('name')"
            @keydown.enter="toggleSort('name')"
            @keydown.space.prevent="toggleSort('name')"
          >
            <span class="inline-flex items-center gap-1">
              {{ $t(columnLabelKey['name']) }}
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
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
          >
            {{ $t(columnLabelKey['version']) }}
          </th>

          <th
            v-if="isColumnVisible('description')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
          >
            {{ $t(columnLabelKey['description']) }}
          </th>

          <th
            v-if="isColumnVisible('downloads')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider text-right"
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
            :role="isSortable('downloads') ? 'columnheader button' : 'columnheader'"
            @click="toggleSort('downloads')"
            @keydown.enter="toggleSort('downloads')"
            @keydown.space.prevent="toggleSort('downloads')"
          >
            <span class="inline-flex items-center gap-1 justify-end">
              {{ $t(columnLabelKey['downloads']) }}
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
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
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
            :role="isSortable('updated') ? 'columnheader button' : 'columnheader'"
            @click="toggleSort('updated')"
            @keydown.enter="toggleSort('updated')"
            @keydown.space.prevent="toggleSort('updated')"
          >
            <span class="inline-flex items-center gap-1">
              {{ $t(columnLabelKey['updated']) }}
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
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
          >
            {{ $t(columnLabelKey['maintainers']) }}
          </th>

          <th
            v-if="isColumnVisible('keywords')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
          >
            {{ $t(columnLabelKey['keywords']) }}
          </th>

          <th
            v-if="isColumnVisible('qualityScore')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider text-right"
          >
            {{ $t(columnLabelKey['qualityScore']) }}
          </th>

          <th
            v-if="isColumnVisible('popularityScore')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider text-right"
          >
            {{ $t(columnLabelKey['popularityScore']) }}
          </th>

          <th
            v-if="isColumnVisible('maintenanceScore')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider text-right"
          >
            {{ $t(columnLabelKey['maintenanceScore']) }}
          </th>

          <th
            v-if="isColumnVisible('combinedScore')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider text-right"
          >
            {{ $t(columnLabelKey['combinedScore']) }}
          </th>

          <th
            v-if="isColumnVisible('security')"
            scope="col"
            class="py-3 px-3 text-xs font-mono font-medium text-fg-muted uppercase tracking-wider"
          >
            {{ $t(columnLabelKey['security']) }}
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
            <td v-if="isColumnVisible('downloads')" class="py-3 px-3 text-right">
              <div class="h-4 w-16 bg-bg-muted rounded animate-pulse ml-auto" />
            </td>
            <td v-if="isColumnVisible('updated')" class="py-3 px-3">
              <div class="h-4 w-20 bg-bg-muted rounded animate-pulse" />
            </td>
            <td v-if="isColumnVisible('maintainers')" class="py-3 px-3">
              <div class="h-4 w-24 bg-bg-muted rounded animate-pulse" />
            </td>
            <td v-if="isColumnVisible('keywords')" class="py-3 px-3">
              <div class="h-4 w-32 bg-bg-muted rounded animate-pulse" />
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
            :selected="selectedIndex === index"
            :index="index"
            @focus="emit('select', index)"
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
