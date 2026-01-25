<script setup lang="ts">
export type SortOption = 'downloads' | 'updated' | 'name-asc' | 'name-desc'

const props = defineProps<{
  /** Current search/filter text */
  filter: string
  /** Current sort option */
  sort: SortOption
  /** Placeholder text for the search input */
  placeholder?: string
  /** Total count of packages (before filtering) */
  totalCount?: number
  /** Filtered count of packages */
  filteredCount?: number
}>()

const emit = defineEmits<{
  'update:filter': [value: string]
  'update:sort': [value: SortOption]
}>()

const filterValue = computed({
  get: () => props.filter,
  set: value => emit('update:filter', value),
})

const sortValue = computed({
  get: () => props.sort,
  set: value => emit('update:sort', value),
})

const sortOptions = [
  { value: 'downloads', label: 'Most downloaded' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
] as const

// Show filter count when filtering is active
const showFilteredCount = computed(() => {
  return (
    props.filter &&
    props.filteredCount !== undefined &&
    props.totalCount !== undefined &&
    props.filteredCount !== props.totalCount
  )
})
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-3 mb-6">
    <!-- Filter input -->
    <div class="flex-1 relative">
      <label for="package-filter" class="sr-only">Filter packages</label>
      <span
        class="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
        aria-hidden="true"
      >
        <span class="i-carbon-search inline-block w-4 h-4" />
      </span>
      <input
        id="package-filter"
        v-model="filterValue"
        type="search"
        :placeholder="placeholder ?? 'Filter packages...'"
        autocomplete="off"
        class="w-full bg-bg-subtle border border-border rounded-lg pl-9 pr-4 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:(border-border-hover outline-none)"
      />
    </div>

    <!-- Sort select -->
    <div class="relative shrink-0">
      <label for="package-sort" class="sr-only">Sort packages</label>
      <select
        id="package-sort"
        v-model="sortValue"
        class="appearance-none bg-bg-subtle border border-border rounded-lg pl-3 pr-8 py-2 font-mono text-sm text-fg cursor-pointer transition-colors duration-200 focus:(border-border-hover outline-none) hover:border-border-hover"
      >
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <span
        class="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
        aria-hidden="true"
      >
        <span class="i-carbon-chevron-down w-4 h-4" />
      </span>
    </div>
  </div>

  <!-- Filtered count indicator -->
  <p v-if="showFilteredCount" class="text-fg-subtle text-xs font-mono mb-4">
    Showing {{ filteredCount }} of {{ totalCount }} packages
  </p>
</template>
