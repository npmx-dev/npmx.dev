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
      <div class="flex items-center gap-2 mb-2">
        <span class="text-3xs text-fg-subtle uppercase tracking-wider">
          {{ getCategoryLabel(category) }}
        </span>
        <!-- TODO: These should be radios, since they are mutually exclusive, and currently this behavior is faked with buttons -->
        <ButtonBase
          :aria-label="
            $t('compare.facets.select_category', { category: getCategoryLabel(category) })
          "
          :aria-pressed="isCategoryAllSelected(category)"
          :disabled="isCategoryAllSelected(category)"
          @click="selectCategory(category)"
          size="small"
        >
          {{ $t('compare.facets.all') }}
        </ButtonBase>
        <span class="text-2xs text-fg-muted/40">/</span>
        <ButtonBase
          :aria-label="
            $t('compare.facets.deselect_category', { category: getCategoryLabel(category) })
          "
          :aria-pressed="isCategoryNoneSelected(category)"
          :disabled="isCategoryNoneSelected(category)"
          @click="deselectCategory(category)"
          size="small"
        >
          {{ $t('compare.facets.none') }}
        </ButtonBase>
      </div>

      <!-- Facet buttons -->
      <div class="flex items-center gap-1.5 flex-wrap" role="group">
        <!-- TODO: These should be checkboxes -->
        <ButtonBase
          v-for="facet in facetsByCategory[category]"
          :key="facet.id"
          size="small"
          :title="facet.comingSoon ? $t('compare.facets.coming_soon') : facet.description"
          :disabled="facet.comingSoon"
          :aria-pressed="isFacetSelected(facet.id)"
          :aria-label="facet.label"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs rounded border transition-colors duration-200 focus-visible:outline-accent/70"
          :class="
            facet.comingSoon
              ? 'text-fg-subtle/50 bg-bg-subtle border-border-subtle cursor-not-allowed'
              : isFacetSelected(facet.id)
                ? 'text-fg-muted bg-bg-muted border-border'
                : 'text-fg-subtle bg-bg-subtle border-border-subtle hover:text-fg-muted hover:border-border'
          "
          @click="!facet.comingSoon && toggleFacet(facet.id)"
          :classicon="
            facet.comingSoon
              ? undefined
              : isFacetSelected(facet.id)
                ? 'i-carbon:checkmark'
                : 'i-carbon:add'
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
