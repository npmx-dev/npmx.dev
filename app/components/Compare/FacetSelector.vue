<script setup lang="ts">
import { debounce } from 'perfect-debounce'
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

const liveRegionText = ref('')
const updateLiveRegion = debounce((message: string) => {
  liveRegionText.value = message
}, 250)

function selectAllFacet(category: string) {
  if (!isCategoryAllSelected(category)) {
    updateLiveRegion($t('selected_all_category_facets', { category }))
    selectCategory(category)
  }
}

function deselectAllFacet(category: string) {
  if (!isCategoryNoneSelected(category)) {
    updateLiveRegion($t('deselected_all_category_facets', { category }))
    deselectCategory(category)
  }
}
</script>

<template>
  <div role="status" aria-live="polite" class="sr-only">{{ liveRegionText }}</div>
  <div class="space-y-3">
    <div v-for="category in categoryOrder" :key="category">
      <div class="flex items-center gap-2 mb-2">
        <span
          :id="`facet-category-label-${category}`"
          class="text-3xs text-fg-subtle uppercase tracking-wider"
        >
          {{ getCategoryLabel(category) }}
        </span>

        <ButtonBase
          size="sm"
          data-facet-category-action="all"
          :data-facet-category="category"
          :aria-label="
            $t('compare.facets.select_all_category_facets', {
              category: getCategoryLabel(category),
            })
          "
          :aria-disabled="isCategoryAllSelected(category)"
          class="aria-disabled:(opacity-40 border-transparent)"
          @click="selectAllFacet(category)"
        >
          {{ $t('compare.facets.all') }}
        </ButtonBase>

        <span class="text-2xs text-fg-muted/40" aria-hidden="true">/</span>

        <ButtonBase
          size="sm"
          data-facet-category-action="none"
          :data-facet-category="category"
          :aria-label="
            $t('compare.facets.deselect_all_category_facets', {
              category: getCategoryLabel(category),
            })
          "
          :aria-disabled="isCategoryNoneSelected(category)"
          class="aria-disabled:(opacity-40 border-transparent)"
          @click="deselectAllFacet(category)"
        >
          {{ $t('compare.facets.none') }}
        </ButtonBase>
      </div>

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
          role="checkbox"
          :title="facet.comingSoon ? $t('compare.facets.coming_soon') : facet.description"
          :disabled="facet.comingSoon"
          :aria-checked="isFacetSelected(facet.id)"
          :aria-label="facet.label"
          class="gap-1 px-1.5 rounded transition-colors text-fg-subtle bg-bg-subtle border-border-subtle enabled:hover:(text-fg-muted border-border) aria-checked:(text-fg-muted bg-bg-muted) focus-visible:outline-accent/70 disabled:(text-fg-subtle/50 bg-bg-subtle border-border-subtle cursor-not-allowed)"
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
