<script setup lang="ts">
import type { PageSize, PaginationMode, ViewMode } from '#shared/types/preferences'
import { PAGE_SIZE_OPTIONS } from '#shared/types/preferences'

const props = defineProps<{
  totalItems: number
  /** When in table view, force pagination mode (no infinite scroll for tables) */
  viewMode?: ViewMode
}>()

const mode = defineModel<PaginationMode>('mode', { required: true })
const pageSize = defineModel<PageSize>('pageSize', { required: true })
const currentPage = defineModel<number>('currentPage', { required: true })

// Whether we should show pagination controls (table view always uses pagination)
const shouldShowControls = computed(() => props.viewMode === 'table' || mode.value === 'paginated')

// Table view forces pagination mode, otherwise use the provided mode
const effectiveMode = computed<PaginationMode>(() =>
  shouldShowControls.value ? 'paginated' : 'infinite',
)

// When 'all' is selected, there's only 1 page with everything
const isShowingAll = computed(() => pageSize.value === 'all')
const effectivePageSize = computed(() => (isShowingAll.value ? props.totalItems : pageSize.value))
const totalPages = computed(() =>
  isShowingAll.value ? 1 : Math.ceil(props.totalItems / (pageSize.value as number)),
)

// Whether to show the mode toggle (hidden in table view since table always uses pagination)
const showModeToggle = computed(() => props.viewMode !== 'table')

const startItem = computed(() => {
  if (props.totalItems === 0) return 0
  if (isShowingAll.value) return 1
  return (currentPage.value - 1) * (pageSize.value as number) + 1
})

const endItem = computed(() => {
  if (isShowingAll.value) return props.totalItems
  return Math.min(currentPage.value * (pageSize.value as number), props.totalItems)
})

const canGoPrev = computed(() => currentPage.value > 1)
const canGoNext = computed(() => currentPage.value < totalPages.value)

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function goPrev() {
  if (canGoPrev.value) {
    currentPage.value = currentPage.value - 1
  }
}

function goNext() {
  if (canGoNext.value) {
    currentPage.value = currentPage.value + 1
  }
}

// Generate visible page numbers with ellipsis
const visiblePages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const pages: (number | 'ellipsis')[] = []

  if (total <= 7) {
    // Show all pages
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    if (current > 3) {
      pages.push('ellipsis')
    }

    // Show pages around current
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (current < total - 2) {
      pages.push('ellipsis')
    }

    // Always show last page
    if (total > 1) {
      pages.push(total)
    }
  }

  return pages
})

function handlePageSizeChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const value = target.value
  // Handle 'all' as a special string value, otherwise parse as number
  const newSize = (value === 'all' ? 'all' : Number(value)) as PageSize
  pageSize.value = newSize
  // Reset to page 1 when changing page size
  currentPage.value = 1
}
</script>

<template>
  <!-- Only show when in paginated mode (table view or explicit paginated mode) -->
  <div
    v-if="shouldShowControls"
    class="flex flex-wrap items-center justify-between gap-4 py-4 border-t border-border mt-6"
  >
    <!-- Left: Mode toggle and page size -->
    <div class="flex items-center gap-4">
      <!-- Pagination mode toggle (hidden in table view - tables always use pagination) -->
      <div
        v-if="showModeToggle"
        class="inline-flex rounded-md border border-border p-0.5 bg-bg-subtle"
        role="group"
        :aria-label="$t('filters.pagination.mode_label')"
      >
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-mono rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :class="mode === 'infinite' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="mode === 'infinite'"
          @click="mode = 'infinite'"
        >
          {{ $t('filters.pagination.infinite') }}
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-mono rounded-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :class="mode === 'paginated' ? 'bg-bg-muted text-fg' : 'text-fg-muted hover:text-fg'"
          :aria-pressed="mode === 'paginated'"
          @click="mode = 'paginated'"
        >
          {{ $t('filters.pagination.paginated') }}
        </button>
      </div>

      <!-- Page size (shown when paginated or table view) -->
      <div v-if="effectiveMode === 'paginated'" class="relative shrink-0">
        <label for="page-size" class="sr-only">{{ $t('filters.pagination.items_per_page') }}</label>
        <select
          id="page-size"
          :value="pageSize"
          class="appearance-none bg-bg-subtle border border-border rounded-md pl-3 pr-8 py-1 font-mono text-sm text-fg cursor-pointer transition-colors duration-200 hover:border-border-hover focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
          @change="handlePageSizeChange"
        >
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
            {{
              size === 'all'
                ? $t('filters.pagination.all_yolo')
                : $t('filters.pagination.per_page', { count: size })
            }}
          </option>
        </select>
        <div
          class="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
          aria-hidden="true"
        >
          <span class="i-carbon-chevron-down w-3 h-3" />
        </div>
      </div>
    </div>

    <!-- Right: Page info and navigation (paginated mode only) -->
    <div v-if="effectiveMode === 'paginated'" class="flex items-center gap-4">
      <!-- Showing X-Y of Z -->
      <span class="text-sm font-mono text-fg-muted">
        {{
          $t('filters.pagination.showing', {
            start: startItem,
            end: endItem,
            total: totalItems.toLocaleString(),
          })
        }}
      </span>

      <!-- Page navigation -->
      <nav
        v-if="totalPages > 1"
        class="flex items-center gap-1"
        :aria-label="$t('filters.pagination.nav_label')"
      >
        <!-- Previous button -->
        <button
          type="button"
          class="p-1.5 rounded hover:bg-bg-muted text-fg-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :disabled="!canGoPrev"
          :aria-label="$t('filters.pagination.previous')"
          @click="goPrev"
        >
          <span class="i-carbon-chevron-left w-4 h-4" aria-hidden="true" />
        </button>

        <!-- Page numbers -->
        <template v-for="(page, idx) in visiblePages" :key="idx">
          <span v-if="page === 'ellipsis'" class="px-2 text-fg-subtle font-mono">…</span>
          <button
            v-else
            type="button"
            class="min-w-[32px] h-8 px-2 font-mono text-sm rounded transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
            :class="
              page === currentPage
                ? 'bg-fg text-bg'
                : 'text-fg-muted hover:text-fg hover:bg-bg-muted'
            "
            :aria-current="page === currentPage ? 'page' : undefined"
            @click="goToPage(page)"
          >
            {{ page }}
          </button>
        </template>

        <!-- Next button -->
        <button
          type="button"
          class="p-1.5 rounded hover:bg-bg-muted text-fg-muted hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :disabled="!canGoNext"
          :aria-label="$t('filters.pagination.next')"
          @click="goNext"
        >
          <span class="i-carbon-chevron-right w-4 h-4" aria-hidden="true" />
        </button>
      </nav>
    </div>
  </div>
</template>
