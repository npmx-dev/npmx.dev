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

const sortOptions = computed(
  () =>
    [
      { value: 'downloads', label: $t('package.sort.downloads') },
      { value: 'updated', label: $t('package.sort.updated') },
      { value: 'name-asc', label: $t('package.sort.name_asc') },
      { value: 'name-desc', label: $t('package.sort.name_desc') },
    ] as const,
)

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
      <label for="package-filter" class="sr-only">{{ $t('package.list.filter_label') }}</label>
      <div
        class="absolute h-full w-10 flex items-center justify-center text-fg-subtle pointer-events-none"
        aria-hidden="true"
      >
        <div class="i-carbon:search inline-block w-4 h-4" />
      </div>
      <input
        id="package-filter"
        v-model="filterValue"
        type="search"
        :placeholder="placeholder ?? $t('package.list.filter_placeholder')"
        v-bind="noCorrect"
        class="w-full bg-bg-subtle border border-border rounded-lg ps-10 pe-4 py-2 font-mono text-sm text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:(border-border-hover outline-none)"
      />
    </div>

    <!-- Sort select -->
    <div class="relative shrink-0 flex">
      <label for="package-sort" class="sr-only">{{ $t('package.list.sort_label') }}</label>
      <div class="relative">
        <select
          id="package-sort"
          v-model="sortValue"
          class="appearance-none bg-bg-subtle border border-border rounded-lg ps-3 pe-8 py-2 font-mono text-sm text-fg cursor-pointer transition-colors duration-200 focus:(border-border-hover outline-none) hover:border-border-hover"
        >
          <option v-for="option in sortOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <div
          class="absolute inset-ie-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
          aria-hidden="true"
        >
          <div class="i-carbon:chevron-down w-4 h-4" />
        </div>
      </div>
    </div>
  </div>

  <!-- Filtered count indicator -->
  <p v-if="showFilteredCount" class="text-fg-subtle text-xs font-mono mb-4">
    {{ $t('package.list.showing_count', { filtered: filteredCount, total: totalCount }) }}
  </p>
</template>
