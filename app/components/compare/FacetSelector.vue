<script setup lang="ts">
import type { ComparisonFacet } from '#shared/types'
import { FACET_INFO, FACETS_BY_CATEGORY, CATEGORY_ORDER } from '#shared/types/comparison'

const { isFacetSelected, toggleFacet, selectCategory, deselectCategory } = useFacetSelection()

// Enrich facets with their info for rendering
const facetsByCategory = computed(() => {
  const result: Record<
    string,
    { facet: ComparisonFacet; info: (typeof FACET_INFO)[ComparisonFacet] }[]
  > = {}
  for (const category of CATEGORY_ORDER) {
    result[category] = FACETS_BY_CATEGORY[category].map(facet => ({
      facet,
      info: FACET_INFO[facet],
    }))
  }
  return result
})

// Check if all non-comingSoon facets in a category are selected
function isCategoryAllSelected(category: string): boolean {
  const facets = facetsByCategory.value[category] ?? []
  const selectableFacets = facets.filter(f => !f.info.comingSoon)
  return selectableFacets.length > 0 && selectableFacets.every(f => isFacetSelected(f.facet))
}

// Check if no facets in a category are selected
function isCategoryNoneSelected(category: string): boolean {
  const facets = facetsByCategory.value[category] ?? []
  const selectableFacets = facets.filter(f => !f.info.comingSoon)
  return selectableFacets.length > 0 && selectableFacets.every(f => !isFacetSelected(f.facet))
}
</script>

<template>
  <div class="space-y-3" role="group" :aria-label="$t('compare.facets.group_label')">
    <div v-for="category in CATEGORY_ORDER" :key="category">
      <!-- Category header with all/none buttons -->
      <div class="flex items-center gap-2 mb-2">
        <span class="text-[10px] text-fg-subtle uppercase tracking-wider">
          {{ $t(`compare.facets.categories.${category}`) }}
        </span>
        <button
          type="button"
          class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline"
          :class="
            isCategoryAllSelected(category)
              ? 'text-fg-muted'
              : 'text-fg-muted/60 hover:text-fg-muted'
          "
          :aria-label="
            $t('compare.facets.select_category', {
              category: $t(`compare.facets.categories.${category}`),
            })
          "
          :disabled="isCategoryAllSelected(category)"
          @click="selectCategory(category)"
        >
          {{ $t('compare.facets.all') }}
        </button>
        <span class="text-[10px] text-fg-muted/40">/</span>
        <button
          type="button"
          class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline"
          :class="
            isCategoryNoneSelected(category)
              ? 'text-fg-muted'
              : 'text-fg-muted/60 hover:text-fg-muted'
          "
          :aria-label="
            $t('compare.facets.deselect_category', {
              category: $t(`compare.facets.categories.${category}`),
            })
          "
          :disabled="isCategoryNoneSelected(category)"
          @click="deselectCategory(category)"
        >
          {{ $t('compare.facets.none') }}
        </button>
      </div>

      <!-- Facet buttons -->
      <div class="flex items-center gap-1.5 flex-wrap" role="group">
        <button
          v-for="{ facet, info } in facetsByCategory[category]"
          :key="facet"
          type="button"
          :title="info.comingSoon ? $t('compare.facets.coming_soon') : info.description"
          :disabled="info.comingSoon"
          :aria-pressed="isFacetSelected(facet)"
          :aria-label="info.label"
          class="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-xs rounded border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
          :class="
            info.comingSoon
              ? 'text-fg-subtle/50 bg-bg-subtle border-border-subtle cursor-not-allowed'
              : isFacetSelected(facet)
                ? 'text-fg-muted bg-bg-muted border-border'
                : 'text-fg-subtle bg-bg-subtle border-border-subtle hover:text-fg-muted hover:border-border'
          "
          @click="!info.comingSoon && toggleFacet(facet)"
        >
          <span
            v-if="!info.comingSoon"
            class="w-3 h-3"
            :class="isFacetSelected(facet) ? 'i-carbon:checkmark' : 'i-carbon:add'"
            aria-hidden="true"
          />
          {{ info.label }}
          <span v-if="info.comingSoon" class="text-[9px]"
            >({{ $t('compare.facets.coming_soon') }})</span
          >
        </button>
      </div>
    </div>
  </div>
</template>
