<script setup lang="ts">
import type {
  DependencySortOption,
  PackageDependencyItem,
} from '#shared/types/package-dependencies'
import type { ColumnConfig, ColumnId, StructuredFilters } from '#shared/types/preferences'
import { DEFAULT_COLUMNS } from '#shared/types/preferences'
import type { PackageDependencyInsights } from '~/composables/usePackageDependencyInsights'

const props = defineProps<{
  items: PackageDependencyItem[]
  sort: DependencySortOption
  showSkeleton: boolean
  insights?: PackageDependencyInsights
  columns?: ColumnConfig[]
  filters?: StructuredFilters
}>()

const emit = defineEmits<{
  'update:sort': [value: DependencySortOption]
  'clickKeyword': [keyword: string]
}>()

function toggleNameSort() {
  emit('update:sort', props.sort === 'name-asc' ? 'name-desc' : 'name-asc')
}

const nameSortDirection = computed(() =>
  props.sort.startsWith('name') ? (props.sort === 'name-asc' ? 'asc' : 'desc') : null,
)

const activeColumns = computed(() => props.columns ?? DEFAULT_COLUMNS)

function isColumnVisible(id: string): boolean {
  return activeColumns.value.find(c => c.id === id)?.visible ?? false
}

// Map column IDs to i18n keys
const columnLabels = computed(() => ({
  name: $t('filters.columns.name'),
  version: $t('filters.columns.version'),
  description: $t('filters.columns.description'),
  downloads: $t('filters.columns.downloads'),
  updated: $t('filters.columns.published'),
  maintainers: $t('filters.columns.maintainers'),
  keywords: $t('filters.columns.keywords'),
  security: $t('filters.columns.security'),
  selection: $t('filters.columns.selection'),
}))

function getColumnLabel(id: ColumnId): string {
  return columnLabels.value[id] ?? id
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-start">
      <thead class="border-b border-border">
        <tr>
          <th
            scope="col"
            class="py-3 px-3 text-xs text-start text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none hover:text-fg transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-inset focus-visible:outline-none"
            :aria-sort="
              nameSortDirection
                ? nameSortDirection === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined
            "
            tabindex="0"
            @click="toggleNameSort"
            @keydown.enter="toggleNameSort"
            @keydown.space.prevent="toggleNameSort"
          >
            <span class="inline-flex items-center gap-1">
              {{ getColumnLabel('name') }}
              <span
                v-if="nameSortDirection"
                class="i-lucide:chevron-down w-3 h-3"
                :class="nameSortDirection === 'asc' ? 'rotate-180' : ''"
                aria-hidden="true"
              />
              <span
                v-else
                class="i-lucide:chevrons-up-down w-3 h-3 opacity-30"
                aria-hidden="true"
              />
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
            class="py-3 px-3 text-xs text-end text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('downloads') }}
          </th>

          <th
            v-if="isColumnVisible('updated')"
            scope="col"
            class="py-3 px-3 text-xs text-end text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('updated') }}
          </th>

          <th
            v-if="isColumnVisible('maintainers')"
            scope="col"
            class="py-3 px-3 text-xs text-end text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('maintainers') }}
          </th>

          <th
            v-if="isColumnVisible('keywords')"
            scope="col"
            class="py-3 px-3 text-xs text-end text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('keywords') }}
          </th>

          <th
            v-if="isColumnVisible('security')"
            scope="col"
            class="py-3 px-3 text-xs text-end text-fg-muted font-mono font-medium uppercase tracking-wider whitespace-nowrap select-none"
          >
            {{ getColumnLabel('security') }}
          </th>
        </tr>
      </thead>
      <tbody>
        <DependenciesTableRow
          v-for="(item, index) in items"
          :key="item.name"
          :item="item"
          :index="index"
          :show-skeleton="showSkeleton"
          :insights="insights"
          :columns="activeColumns"
          :filters="filters"
          @click-keyword="emit('clickKeyword', $event)"
        />
      </tbody>
    </table>

    <div v-if="items.length === 0" class="py-12 text-center text-fg-subtle font-mono text-sm">
      {{ $t('package.dependencies.no_matches') }}
    </div>
  </div>
</template>
