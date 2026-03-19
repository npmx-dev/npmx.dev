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
  <div class="space-y-3" role="group" :aria-label="$t('compare.facets.group_label')">
    <div v-for="category in categoryOrder" :key="category">
      <!-- Category header with all/none buttons -->
      <div
        class="flex items-center gap-2 mb-2"
        :aria-labelledby="`facet-category-label-${category}`"
      >
        <span
          :id="`facet-category-label-${category}`"
          class="text-3xs text-fg-subtle uppercase tracking-wider"
        >
          {{ getCategoryLabel(category) }}
        </span>
        <ButtonBase
          role="radio"
          :aria-checked="isCategoryAllSelected(category)"
          :tabindex="getCategoryActiveControl(category) === 'all' ? 0 : -1"
          data-radio-type="all"
          @keydown="handleCategoryControlKeydown(category, $event)"
          @click="selectCategory(category)"
          size="sm"
        >
          {{ $t('compare.facets.all') }}
        </ButtonBase>
        <span class="text-2xs text-fg-muted/40" aria-hidden="true">/</span>
        <ButtonBase
          role="radio"
          :aria-checked="isCategoryNoneSelected(category)"
          :tabindex="getCategoryActiveControl(category) === 'none' ? 0 : -1"
          data-radio-type="none"
          @keydown="handleCategoryControlKeydown(category, $event)"
          @click="deselectCategory(category)"
          size="sm"
        >
          {{ $t('compare.facets.none') }}
        </ButtonBase>
      </div>

      <!-- Facet buttons -->
      <div
        class="flex items-center gap-1.5 flex-wrap"
        role="group"
        :aria-labelledby="`facet-category-label-${category}`"
        data-facet-category-facets
      >
        <ButtonBase
          v-for="facet in facetsByCategory[category]"
          :key="facet.id"
          size="sm"
          :title="facet.comingSoon ? $t('compare.facets.coming_soon') : facet.description"
          :aria-disabled="facet.comingSoon"
          role="checkbox"
          :aria-checked="isFacetSelected(facet.id)"
          class="gap-1 px-1.5 rounded transition-colors"
          :class="
            facet.comingSoon
              ? 'text-fg-subtle/50 bg-bg-subtle border-border-subtle cursor-not-allowed'
              : isFacetSelected(facet.id)
                ? 'text-fg-muted bg-bg-muted'
                : 'text-fg-subtle bg-bg-subtle border-border-subtle hover:text-fg-muted hover:border-border'
          "
          @click="!facet.comingSoon && toggleFacet(facet.id)"
          :classicon="
            facet.comingSoon
              ? undefined
              : isFacetSelected(facet.id)
                ? 'i-lucide:check'
                : 'i-lucide:plus'
          "
        >
          {{ facet.label }}
          <span v-if="facet.comingSoon" class="text-4xs"
            >({{ $t('compare.facets.coming_soon') }})</span
          >
        </ButtonBase>
      </div>
    </div>
  </div>
</template>
