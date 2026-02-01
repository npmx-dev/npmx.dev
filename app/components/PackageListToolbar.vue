<script setup lang="ts">
import type {
  ColumnConfig,
  ColumnId,
  DownloadRange,
  FilterChip,
  PageSize,
  PaginationMode,
  SearchScope,
  SecurityFilter,
  SortKey,
  SortOption,
  StructuredFilters,
  UpdatedWithin,
  ViewMode,
} from '#shared/types/preferences'
import {
  buildSortOption,
  parseSortOption,
  SORT_KEYS,
  toggleDirection,
} from '#shared/types/preferences'

const props = defineProps<{
  filters: StructuredFilters
  columns: ColumnConfig[]
  totalCount: number
  filteredCount: number
  availableKeywords?: string[]
  activeFilters: FilterChip[]
  /** When true, shows search-specific UI (relevance sort, no filters) */
  searchContext?: boolean
}>()

const sortOption = defineModel<SortOption>('sortOption', { required: true })
const viewMode = defineModel<ViewMode>('viewMode', { required: true })
const paginationMode = defineModel<PaginationMode>('paginationMode', { required: true })
const pageSize = defineModel<PageSize>('pageSize', { required: true })

const emit = defineEmits<{
  'toggleColumn': [columnId: ColumnId]
  'resetColumns': []
  'clearFilter': [chip: FilterChip]
  'clearAllFilters': []
  'update:text': [value: string]
  'update:searchScope': [value: SearchScope]
  'update:downloadRange': [value: DownloadRange]
  'update:security': [value: SecurityFilter]
  'update:updatedWithin': [value: UpdatedWithin]
  'toggleKeyword': [keyword: string]
}>()

const showingFiltered = computed(() => props.filteredCount !== props.totalCount)

// Parse current sort option into key and direction
const currentSort = computed(() => parseSortOption(sortOption.value))

// Get available sort keys based on context
const availableSortKeys = computed(() => {
  if (props.searchContext) {
    // In search context: show relevance (enabled) and others (disabled)
    return SORT_KEYS.filter(k => !k.searchOnly || k.key === 'relevance').map(k =>
      Object.assign({}, k, {
        disabled: k.key !== 'relevance',
      }),
    )
  }
  // In org/user context: hide search-only sorts
  return SORT_KEYS.filter(k => !k.searchOnly)
})

// Handle sort key change from dropdown
function handleSortKeyChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const newKey = target.value as SortKey
  const config = SORT_KEYS.find(k => k.key === newKey)
  const direction = config?.defaultDirection ?? 'desc'
  sortOption.value = buildSortOption(newKey, direction)
}

// Toggle sort direction
function handleToggleDirection() {
  const { key, direction } = currentSort.value
  sortOption.value = buildSortOption(key, toggleDirection(direction))
}

// Map sort key to i18n key
const sortKeyLabelKeys: Record<SortKey, string> = {
  'relevance': 'filters.sort.relevance',
  'downloads-week': 'filters.sort.downloads_week',
  'downloads-day': 'filters.sort.downloads_day',
  'downloads-month': 'filters.sort.downloads_month',
  'downloads-year': 'filters.sort.downloads_year',
  'updated': 'filters.sort.updated',
  'name': 'filters.sort.name',
  'quality': 'filters.sort.quality',
  'popularity': 'filters.sort.popularity',
  'maintenance': 'filters.sort.maintenance',
  'score': 'filters.sort.score',
}

function getSortKeyLabelKey(key: SortKey): string {
  return sortKeyLabelKeys[key]
}
</script>

<template>
  <div class="space-y-3 mb-6">
    <!-- Main toolbar row -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <!-- Count display (infinite scroll mode only) -->
      <div
        v-if="viewMode === 'cards' && paginationMode === 'infinite' && !searchContext"
        class="text-sm font-mono text-fg-muted"
      >
        <template v-if="showingFiltered">
          {{
            $t('filters.count.showing_filtered', {
              filtered: filteredCount.toLocaleString(),
              count: totalCount.toLocaleString(),
            })
          }}
        </template>
        <template v-else>
          {{ $t('filters.count.showing_all', { count: totalCount.toLocaleString() }) }}
        </template>
      </div>

      <!-- Count display (paginated/table mode only) -->
      <div
        v-if="(viewMode === 'table' || paginationMode === 'paginated') && !searchContext"
        class="text-sm font-mono text-fg-muted"
      >
        {{
          $t('filters.count.showing_paginated', {
            pageSize: pageSize === 'all' ? filteredCount : pageSize,
            count: filteredCount.toLocaleString(),
          })
        }}
      </div>

      <div class="flex-1" />

      <div
        class="flex flex-wrap items-center gap-3 sm:justify-end justify-between w-full sm:w-auto"
      >
        <!-- Sort controls -->
        <div class="flex items-center gap-1 shrink-0 order-1 sm:order-1">
          <!-- Sort key dropdown -->
          <div class="relative">
            <label for="sort-select" class="sr-only">{{ $t('filters.sort.label') }}</label>
            <select
              id="sort-select"
              :value="currentSort.key"
              class="appearance-none bg-bg-subtle border border-border rounded-md ps-3 pe-8 py-1.5 font-mono text-sm text-fg cursor-pointer transition-colors duration-200 hover:border-border-hover focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
              @change="handleSortKeyChange"
            >
              <option
                v-for="keyConfig in availableSortKeys"
                :key="keyConfig.key"
                :value="keyConfig.key"
                :disabled="keyConfig.disabled"
              >
                {{ $t(getSortKeyLabelKey(keyConfig.key)) }}
              </option>
            </select>
            <div
              class="absolute inset-ie-2 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
              aria-hidden="true"
            >
              <span class="i-carbon-chevron-down w-4 h-4" />
            </div>
          </div>

          <!-- Sort direction toggle (hidden in search context) -->
          <button
            v-if="!searchContext"
            type="button"
            class="p-1.5 rounded border border-border bg-bg-subtle text-fg-muted hover:text-fg hover:border-border-hover transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            :aria-label="$t('filters.sort.toggle_direction')"
            :title="
              currentSort.direction === 'asc'
                ? $t('filters.sort.ascending')
                : $t('filters.sort.descending')
            "
            @click="handleToggleDirection"
          >
            <span
              class="w-4 h-4 block transition-transform duration-200"
              :class="
                currentSort.direction === 'asc'
                  ? 'i-carbon-sort-ascending'
                  : 'i-carbon-sort-descending'
              "
              aria-hidden="true"
            />
          </button>
        </div>

        <!-- View mode toggle - mobile (left side, row 2) -->
        <div class="flex sm:hidden items-center gap-1 order-2">
          <ViewModeToggle v-model="viewMode" />
        </div>

        <!-- Column picker - mobile (right side, row 2) -->
        <ColumnPicker
          v-if="viewMode === 'table'"
          class="flex sm:hidden order-3"
          :columns="columns"
          @toggle="emit('toggleColumn', $event)"
          @reset="emit('resetColumns')"
        />

        <!-- View mode toggle + Column picker - desktop (right side, row 1) -->
        <div class="hidden sm:flex items-center gap-1 order-2">
          <ViewModeToggle v-model="viewMode" />

          <ColumnPicker
            v-if="viewMode === 'table'"
            :columns="columns"
            @toggle="emit('toggleColumn', $event)"
            @reset="emit('resetColumns')"
          />
        </div>
      </div>
    </div>

    <!-- Filter panel (hidden in search context) -->
    <FilterPanel
      v-if="!searchContext"
      :filters="filters"
      :available-keywords="availableKeywords"
      @update:text="emit('update:text', $event)"
      @update:search-scope="emit('update:searchScope', $event)"
      @update:download-range="emit('update:downloadRange', $event)"
      @update:security="emit('update:security', $event)"
      @update:updated-within="emit('update:updatedWithin', $event)"
      @toggle-keyword="emit('toggleKeyword', $event)"
    />

    <!-- Active filter chips (hidden in search context) -->
    <FilterChips
      v-if="!searchContext"
      :chips="activeFilters"
      @remove="emit('clearFilter', $event)"
      @clear-all="emit('clearAllFilters')"
    />
  </div>
</template>
