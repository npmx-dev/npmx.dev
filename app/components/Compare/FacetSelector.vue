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

function getCategoryActiveControl(category: string): 'all' | 'none' {
  if (isCategoryAllSelected(category)) return 'all'
  if (isCategoryNoneSelected(category)) return 'none'
  return 'all'
}

function handleCategoryControlKeydown(category: string, event: KeyboardEvent): void {
  const { key } = event

  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return

  event.preventDefault()

  const target = event.currentTarget as HTMLElement | null
  if (!target) return

  const group = target.closest('[data-facet-category-radiogroup]') as HTMLElement | null
  if (!group) return

  const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'))
  if (!radios.length) return

  const currentIndex = radios.indexOf(target)
  if (currentIndex === -1) return

  let nextIndex = currentIndex

  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + radios.length) % radios.length
  } else if (key === 'ArrowRight' || key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % radios.length
  }

  const nextRadio = radios[nextIndex]
  if (!nextRadio) return
  const radioType = nextRadio.dataset.radioType

  if (radioType === 'all') {
    selectCategory(category)
  } else if (radioType === 'none') {
    deselectCategory(category)
  }

  nextRadio.focus()
}
</script>

<template>
  <div class="space-y-3" role="group" :aria-label="$t('compare.facets.group_label')">
    <div v-for="category in categoryOrder" :key="category">
      <!-- Category header with all/none buttons -->
      <div
        class="flex items-center gap-2 mb-2"
        role="radiogroup"
        :aria-labelledby="`facet-category-label-${category}`"
        data-facet-category-radiogroup
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
          size="small"
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
          size="small"
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
          size="small"
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
