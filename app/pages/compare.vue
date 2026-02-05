<script setup lang="ts">
import { NO_DEPENDENCY_ID } from '~/composables/usePackageComparison'
import { useRouteQuery } from '@vueuse/router'

definePageMeta({
  name: 'compare',
})

const router = useRouter()

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

// Facet selection and info
const { selectedFacets, selectAll, deselectAll, isAllSelected, isNoneSelected } =
  useFacetSelection()

// Fetch comparison data
const { packagesData, status, getFacetValues, isFacetLoading, isColumnLoading } =
  usePackageComparison(packages)

// Fetch module replacement suggestions
const { noDepSuggestions, infoSuggestions, replacements } = useCompareReplacements(packages)

// Map replacements to column order for the grid tooltip
const columnReplacements = computed(() =>
  packages.value.map(pkg => replacements.value.get(pkg) ?? null),
)

// Filter "no dep" suggestions to only show if not already added and we have room
const actionableNoDepSuggestions = computed(() => {
  if (packages.value.length >= 4) return [] // Can't add more
  if (packages.value.includes(NO_DEPENDENCY_ID)) return [] // Already added
  return noDepSuggestions.value
})

// Add "no dependency" column to comparison
function addNoDep() {
  if (packages.value.length >= 4) return
  if (packages.value.includes(NO_DEPENDENCY_ID)) return
  packages.value = [...packages.value, NO_DEPENDENCY_ID]
}

// Get loading state for each column
const columnLoading = computed(() => packages.value.map((_, i) => isColumnLoading(i)))

// Check if we have enough packages to compare
const canCompare = computed(() => packages.value.length >= 2)

// Get headers for the grid
const gridHeaders = computed(() => {
  if (!packagesData.value) return packages.value
  return packagesData.value.map((p, i) =>
    p
      ? p.package.version
        ? `${p.package.name}@${p.package.version}`
        : p.package.name
      : (packages.value[i] ?? ''),
  )
})

// Track which columns are the "no dep" column (for special styling)
const specialColumns = computed(() => packages.value.map(pkg => pkg === NO_DEPENDENCY_ID))

useSeoMeta({
  title: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_title', { packages: packages.value.join(' vs ') })
      : $t('compare.packages.meta_title_empty'),
  description: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_description', { packages: packages.value.join(', ') })
      : $t('compare.packages.meta_description_empty'),
})
</script>

<template>
  <main class="container flex-1 py-12 sm:py-16 w-full">
    <div class="max-w-2xl mx-auto">
      <header class="mb-12">
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('compare.packages.title') }}
          </h1>
          <button
            type="button"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
          >
            <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
        <p class="text-fg-muted text-lg">
          {{ $t('compare.packages.tagline') }}
        </p>
      </header>

      <!-- Package selector -->
      <section class="mb-8" aria-labelledby="packages-heading">
        <h2 id="packages-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
          {{ $t('compare.packages.section_packages') }}
        </h2>
        <ComparePackageSelector v-model="packages" :max="4" />

        <!-- "No dep" replacement suggestions (native, simple) -->
        <div v-if="actionableNoDepSuggestions.length > 0" class="mt-3 space-y-2">
          <CompareReplacementSuggestion
            v-for="suggestion in actionableNoDepSuggestions"
            :key="suggestion.forPackage"
            :package-name="suggestion.forPackage"
            :replacement="suggestion.replacement"
            variant="nodep"
            @add-no-dep="addNoDep"
          />
        </div>

        <!-- Informational replacement suggestions (documented) -->
        <div v-if="infoSuggestions.length > 0" class="mt-3 space-y-2">
          <CompareReplacementSuggestion
            v-for="suggestion in infoSuggestions"
            :key="suggestion.forPackage"
            :package-name="suggestion.forPackage"
            :replacement="suggestion.replacement"
            variant="info"
          />
        </div>
      </section>

      <!-- Facet selector -->
      <section class="mb-8" aria-labelledby="facets-heading">
        <div class="flex items-center gap-2 mb-3">
          <h2 id="facets-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('compare.packages.section_facets') }}
          </h2>
          <button
            type="button"
            class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-accent"
            :class="isAllSelected ? 'text-fg-muted' : 'text-fg-muted/60 hover:text-fg-muted'"
            :disabled="isAllSelected"
            :aria-label="$t('compare.facets.select_all')"
            @click="selectAll"
          >
            {{ $t('compare.facets.all') }}
          </button>
          <span class="text-[10px] text-fg-muted/40" aria-hidden="true">/</span>
          <button
            type="button"
            class="text-[10px] transition-colors focus-visible:outline-none focus-visible:underline focus-visible:underline-accent"
            :class="isNoneSelected ? 'text-fg-muted' : 'text-fg-muted/60 hover:text-fg-muted'"
            :disabled="isNoneSelected"
            :aria-label="$t('compare.facets.deselect_all')"
            @click="deselectAll"
          >
            {{ $t('compare.facets.none') }}
          </button>
        </div>
        <CompareFacetSelector />
      </section>

      <!-- Comparison grid -->
      <section v-if="canCompare" class="mt-10" aria-labelledby="comparison-heading">
        <h2 id="comparison-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
          {{ $t('compare.packages.section_comparison') }}
        </h2>

        <div
          v-if="status === 'pending' && (!packagesData || packagesData.every(p => p === null))"
          class="flex items-center justify-center py-12"
        >
          <LoadingSpinner :text="$t('compare.packages.loading')" />
        </div>

        <div v-else-if="packagesData && packagesData.some(p => p !== null)">
          <!-- Desktop: Grid layout -->
          <div class="hidden md:block overflow-x-auto">
            <CompareComparisonGrid
              :columns="packages.length"
              :headers="gridHeaders"
              :special-columns="specialColumns"
              :replacements="columnReplacements"
            >
              <CompareFacetRow
                v-for="facet in selectedFacets"
                :key="facet.id"
                :label="facet.label"
                :description="facet.description"
                :values="getFacetValues(facet.id)"
                :facet-loading="isFacetLoading(facet.id)"
                :column-loading="columnLoading"
                :bar="facet.id !== 'lastUpdated'"
                :headers="gridHeaders"
              />
            </CompareComparisonGrid>
          </div>

          <!-- Mobile: Card-based layout -->
          <div class="md:hidden space-y-3">
            <CompareFacetCard
              v-for="facet in selectedFacets"
              :key="facet.id"
              :label="facet.label"
              :description="facet.description"
              :values="getFacetValues(facet.id)"
              :facet-loading="isFacetLoading(facet.id)"
              :column-loading="columnLoading"
              :bar="facet.id !== 'lastUpdated'"
              :headers="gridHeaders"
            />
          </div>

          <h2
            id="comparison-heading"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-4 mt-10"
          >
            {{ $t('package.downloads.title') }}
          </h2>

          <CompareLineChart :packages />
        </div>

        <div v-else class="text-center py-12" role="alert">
          <p class="text-fg-muted">{{ $t('compare.packages.error') }}</p>
        </div>
      </section>

      <!-- Empty state -->
      <section
        v-else
        class="text-center px-1.5 py-16 border border-dashed border-border rounded-lg"
      >
        <div class="i-carbon:compare w-12 h-12 text-fg-subtle mx-auto mb-4" aria-hidden="true" />
        <h2 class="font-mono text-lg text-fg-muted mb-2">
          {{ $t('compare.packages.empty_title') }}
        </h2>
        <p class="text-sm text-fg-subtle max-w-md mx-auto">
          {{ $t('compare.packages.empty_description') }}
        </p>
      </section>
    </div>
  </main>
</template>
