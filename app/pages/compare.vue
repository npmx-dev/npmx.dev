<script setup lang="ts">
import { FACET_INFO, type ComparisonFacet } from '#shared/types/comparison'
import { useRouteQuery } from '@vueuse/router'

const { t } = useI18n()

definePageMeta({
  name: 'compare',
})

// Sync packages with URL query param (stable ref - doesn't change on other query changes)
const packagesParam = useRouteQuery<string>('packages', '', { mode: 'replace' })

// Parse package names from comma-separated string
const packages = computed({
  get() {
    if (!packagesParam.value) return []
    return packagesParam.value
      .split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .slice(0, 4)
  },
  set(value) {
    packagesParam.value = value.length > 0 ? value.join(',') : ''
  },
})

// Facet selection
const { selectedFacets, selectAll, deselectAll, isAllSelected, isNoneSelected } =
  useFacetSelection()

// Fetch comparison data
const { packagesData, status, getMetricValues, isFacetLoading } = usePackageComparison(packages)

// Check if we have enough packages to compare
const canCompare = computed(() => packages.value.length >= 2)

// Get headers for the grid
const gridHeaders = computed(() => {
  if (!packagesData.value) return packages.value
  return packagesData.value.map((p, i) =>
    p ? `${p.package.name}@${p.package.version}` : (packages.value[i] ?? ''),
  )
})

useSeoMeta({
  title: () =>
    packages.value.length > 0
      ? t('compare.packages.meta_title', { packages: packages.value.join(' vs ') })
      : t('compare.packages.meta_title_empty'),
  description: () =>
    packages.value.length > 0
      ? t('compare.packages.meta_description', { packages: packages.value.join(', ') })
      : t('compare.packages.meta_description_empty'),
})
</script>

<template>
  <main class="container py-8 xl:py-12">
    <header class="mb-8">
      <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-2">
        {{ t('compare.packages.title') }}
      </h1>
      <p class="text-fg-muted">
        {{ t('compare.packages.tagline') }}
      </p>
    </header>

    <!-- Package selector -->
    <section class="mb-8" aria-labelledby="packages-heading">
      <h2 id="packages-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
        {{ t('compare.packages.section_packages') }}
      </h2>
      <ComparePackageSelector v-model="packages" :max="4" />
    </section>

    <!-- Facet selector -->
    <section class="mb-8" aria-labelledby="facets-heading">
      <div class="flex items-center gap-2 mb-3">
        <h2 id="facets-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
          {{ t('compare.packages.section_facets') }}
        </h2>
        <button
          type="button"
          class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline"
          :class="isAllSelected ? 'text-fg-muted' : 'text-fg-muted/60 hover:text-fg-muted'"
          :disabled="isAllSelected"
          :aria-label="t('compare.facets.select_all')"
          @click="selectAll"
        >
          {{ t('compare.facets.all') }}
        </button>
        <span class="text-[10px] text-fg-muted/40" aria-hidden="true">/</span>
        <button
          type="button"
          class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline"
          :class="isNoneSelected ? 'text-fg-muted' : 'text-fg-muted/60 hover:text-fg-muted'"
          :disabled="isNoneSelected"
          :aria-label="t('compare.facets.deselect_all')"
          @click="deselectAll"
        >
          {{ t('compare.facets.none') }}
        </button>
      </div>
      <CompareFacetSelector />
    </section>

    <!-- Comparison grid -->
    <section v-if="canCompare" class="mt-10" aria-labelledby="comparison-heading">
      <h2 id="comparison-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        {{ t('compare.packages.section_comparison') }}
      </h2>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-12">
        <LoadingSpinner :text="t('compare.packages.loading')" />
      </div>

      <div v-else-if="packagesData && packagesData.length > 0">
        <CompareComparisonGrid :columns="packages.length" :headers="gridHeaders">
          <CompareMetricRow
            v-for="facet in selectedFacets"
            :key="facet"
            :label="FACET_INFO[facet].label"
            :description="FACET_INFO[facet].description"
            :values="getMetricValues(facet)"
            :loading="isFacetLoading(facet)"
            :bar="facet !== 'lastUpdated'"
          />
        </CompareComparisonGrid>
      </div>

      <div v-else class="text-center py-12" role="alert">
        <p class="text-fg-muted">{{ t('compare.packages.error') }}</p>
      </div>
    </section>

    <!-- Empty state -->
    <section v-else class="text-center py-16 border border-dashed border-border rounded-lg">
      <div class="i-carbon-compare w-12 h-12 text-fg-subtle mx-auto mb-4" aria-hidden="true" />
      <h2 class="font-mono text-lg text-fg-muted mb-2">{{ t('compare.packages.empty_title') }}</h2>
      <p class="text-sm text-fg-subtle max-w-md mx-auto">
        {{ t('compare.packages.empty_description') }}
      </p>
    </section>
  </main>
</template>
