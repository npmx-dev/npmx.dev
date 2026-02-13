<script setup lang="ts">
const {
  isFacetSelected,
  toggleFacet,
  selectCategory,
  deselectCategory,
  facetsByCategory,
  categoryOrder,
  getCategoryLabel,
} = useFacetSelection()

// Check if all non-comingSoon facets in a category are selected
function isCategoryAllSelected(category: string): boolean {
  const facets = facetsByCategory.value[category] ?? []
  const selectableFacets = facets.filter(f => !f.comingSoon)
  return selectableFacets.length > 0 && selectableFacets.every(f => isFacetSelected(f.id))
}

// Check if no facets in a category are selected
function isCategoryNoneSelected(category: string): boolean {
  const facets = facetsByCategory.value[category] ?? []
  const selectableFacets = facets.filter(f => !f.comingSoon)
  return selectableFacets.length > 0 && selectableFacets.every(f => !isFacetSelected(f.id))
}
</script>

<template>
  <div class="space-y-6" role="group" :aria-label="$t('compare.facets.group_label')">
    <div v-for="category in categoryOrder" :key="category">
      <CheckboxBase
        :aria-label="$t('compare.facets.select_category', { category: getCategoryLabel(category) })"
        :model-value="isCategoryAllSelected(category)"
        :value="category"
        @update:model-value="
          isCategoryAllSelected(category) ? deselectCategory(category) : selectCategory(category)
        "
        :indeterminate="!isCategoryAllSelected(category) && !isCategoryNoneSelected(category)"
        class="uppercase tracking-widest mb-2"
      >
        {{ getCategoryLabel(category) }}
      </CheckboxBase>

      <!-- Facet buttons -->
      <div class="flex items-center gap-1.5 flex-wrap" role="group">
        <!-- TODO: These should be checkboxes -->
        <CheckboxBase
          v-for="facet in facetsByCategory[category]"
          :key="facet.id"
          size="small"
          :title="facet.comingSoon ? $t('compare.facets.coming_soon') : facet.description"
          :disabled="facet.comingSoon"
          :model-value="isFacetSelected(facet.id)"
          :value="facet.id"
          @update:model-value="!facet.comingSoon && toggleFacet(facet.id)"
        >
          {{ facet.label }}
          <span v-if="facet.comingSoon" class="text-4xs"
            >({{ $t('compare.facets.coming_soon') }})</span
          >
        </CheckboxBase>
      </div>
    </div>
  </div>
</template>
