<script setup lang="ts">
import type { FacetInfoWithLabels } from '~/composables/useFacetSelection'

const {
  selectedFacets,
  isFacetSelected,
  toggleFacet,
  selectCategory,
  deselectCategory,
  facetsByCategory,
  categoryOrder,
  getCategoryLabel,
} = useFacetSelection()

/** Native checkbox disabled when coming soon or this is the only selected facet (must keep ≥1). */
function isFacetCheckboxDisabled(facet: FacetInfoWithLabels): boolean {
  if (facet.comingSoon) return true
  return selectedFacets.value.length === 1 && isFacetSelected(facet.id)
}

function onFacetChange(facet: FacetInfoWithLabels) {
  if (isFacetCheckboxDisabled(facet)) return
  toggleFacet(facet.id)
}

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
          size="sm"
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
          size="sm"
        >
          {{ $t('compare.facets.none') }}
        </ButtonBase>
      </div>

      <div
        class="flex items-center gap-1.5 flex-wrap"
        role="group"
        :aria-label="getCategoryLabel(category)"
      >
        <label
          v-for="facet in facetsByCategory[category]"
          :key="facet.id"
          class="flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-xs transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-accent/70"
          :class="
            facet.comingSoon
              ? 'text-fg-subtle/50 bg-bg-subtle border-border-subtle cursor-not-allowed'
              : isFacetCheckboxDisabled(facet)
                ? 'text-fg-muted bg-bg-muted border-border opacity-90 cursor-not-allowed'
                : isFacetSelected(facet.id)
                  ? 'text-fg-muted bg-bg-muted border-border cursor-pointer'
                  : 'text-fg-subtle bg-bg-subtle border-border-subtle hover:text-fg-muted hover:border-border cursor-pointer'
          "
        >
          <input
            type="checkbox"
            :data-facet-id="facet.id"
            class="size-3.5 shrink-0 accent-accent rounded border-border disabled:opacity-60"
            :checked="isFacetSelected(facet.id)"
            :disabled="isFacetCheckboxDisabled(facet)"
            :title="facet.comingSoon ? $t('compare.facets.coming_soon') : facet.description"
            @change="onFacetChange(facet)"
          />
          <span>{{ facet.label }}</span>
          <span v-if="facet.comingSoon" class="text-4xs"
            >({{ $t('compare.facets.coming_soon') }})</span
          >
        </label>
      </div>
    </div>
  </div>
</template>
