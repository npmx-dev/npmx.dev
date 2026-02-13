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
      { value: 'updated', label: $t('package.sort.published') },
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
        <div class="i-lucide:search w-4 h-4" />
      </div>
      <InputBase
        id="package-filter"
        v-model="filterValue"
        type="search"
        :placeholder="placeholder ?? $t('package.list.filter_placeholder')"
        no-correct
        class="w-full min-w-25 ps-10"
        size="medium"
      />
    </div>

    <!-- Sort select -->
    <SelectField
      :label="$t('package.list.sort_label')"
      hidden-label
      id="package-sort"
      class="relative shrink-0"
      v-model="sortValue"
      :items="sortOptions.map(option => ({ label: option.label, value: option.value }))"
    />
  </div>

  <!-- Filtered count indicator -->
  <p v-if="showFilteredCount" class="text-fg-subtle text-xs font-mono mb-4">
    {{ $t('package.list.showing_count', { filtered: filteredCount, total: totalCount }) }}
  </p>
</template>
