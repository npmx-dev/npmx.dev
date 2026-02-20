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
  /** Sort keys to force-disable (e.g. when the current provider doesn't support them) */
  disabledSortKeys?: SortKey[]
}>()

const { t } = useI18n()

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
const disabledSet = computed(() => new Set(props.disabledSortKeys ?? []))

const availableSortKeys = computed(() => {
  const applyDisabled = (k: (typeof SORT_KEYS)[number]) => ({
    ...k,
    disabled: k.disabled || disabledSet.value.has(k.key),
  })

  if (props.searchContext) {
    // In search context: show relevance + non-disabled sorts (downloads, updated, name)
    return SORT_KEYS.filter(k => !k.searchOnly || k.key === 'relevance').map(applyDisabled)
  }
  // In org/user context: hide search-only sorts
  return SORT_KEYS.filter(k => !k.searchOnly).map(applyDisabled)
})

// Handle sort key change from dropdown
const sortKeyModel = computed<SortKey>({
  get: () => currentSort.value.key,
  set: newKey => {
    const config = SORT_KEYS.find(k => k.key === newKey)
    const direction = config?.defaultDirection ?? 'desc'
    sortOption.value = buildSortOption(newKey, direction)
  },
})

// Toggle sort direction
function handleToggleDirection() {
  const { key, direction } = currentSort.value
  sortOption.value = buildSortOption(key, toggleDirection(direction))
}

// Map sort key to i18n key
const sortKeyLabelKeys = computed<Record<SortKey, string>>(() => ({
  'relevance': t('filters.sort.relevance'),
  'downloads-week': t('filters.sort.downloads_week'),
  'downloads-day': t('filters.sort.downloads_day'),
  'downloads-month': t('filters.sort.downloads_month'),
  'downloads-year': t('filters.sort.downloads_year'),
  'updated': t('filters.sort.published'),
  'name': t('filters.sort.name'),
  'quality': t('filters.sort.quality'),
  'popularity': t('filters.sort.popularity'),
  'maintenance': t('filters.sort.maintenance'),
  'score': t('filters.sort.score'),
}))

function getSortKeyLabelKey(key: SortKey): string {
  return sortKeyLabelKeys.value[key]
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
            $t(
              'filters.count.showing_filtered',
              {
                filtered: $n(filteredCount),
                count: $n(totalCount),
              },
              totalCount,
            )
          }}
        </template>
        <template v-else>
          {{ $t('filters.count.showing_all', { count: $n(totalCount) }, totalCount) }}
        </template>
      </div>

      <!-- Count display (paginated/table mode only) -->
      <div
        v-if="(viewMode === 'table' || paginationMode === 'paginated') && !searchContext"
        class="text-sm font-mono text-fg-muted"
      >
        {{
          $t(
            'filters.count.showing_paginated',
            {
              pageSize: pageSize === 'all' ? $n(filteredCount) : Math.min(pageSize, filteredCount),
              count: $n(filteredCount),
            },
            filteredCount,
          )
        }}
      </div>

      <div class="flex-1" />

      <div
        class="flex flex-wrap items-center gap-3 sm:justify-end justify-between w-full sm:w-auto"
      >
        <!-- Sort controls -->
        <div class="flex items-center gap-1 shrink-0 order-1 sm:order-1">
          <!-- Sort key dropdown -->
          <SelectField
            :label="$t('filters.sort.label')"
            hidden-label
            id="sort-select"
            v-model="sortKeyModel"
            :items="
              availableSortKeys.map(keyConfig => ({
                label: getSortKeyLabelKey(keyConfig.key),
                value: keyConfig.key,
                disabled: keyConfig.disabled,
              }))
            "
          />

          <!-- Sort direction toggle -->
          <button
            v-if="!searchContext || currentSort.key !== 'relevance'"
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
                  ? 'i-lucide:arrow-down-narrow-wide'
                  : 'i-lucide:arrow-down-wide-narrow'
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
