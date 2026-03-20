<script setup lang="ts">
import { NO_DEPENDENCY_ID } from '~/composables/usePackageComparison'
import { useRouteQuery } from '@vueuse/router'
import FacetBarChart from '~/components/Compare/FacetBarChart.vue'

definePageMeta({
  name: 'compare',
  preserveScrollOnQuery: true,
})

const { locale } = useI18n()
const router = useRouter()
const canGoBack = useCanGoBack()
const { copied, copy } = useClipboard({ copiedDuring: 2000 })
const maxPackages = 4

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
      .slice(0, maxPackages)
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

// Whether the "no dependency" baseline column is active
const showNoDependency = computed(() => packages.value.includes(NO_DEPENDENCY_ID))

// Build column definitions for real packages only (no-dep is handled separately by the grid)
const gridColumns = computed(() =>
  packages.value
    .map((pkg, i) => ({ pkg, originalIndex: i }))
    .filter(({ pkg }) => pkg !== NO_DEPENDENCY_ID)
    .map(({ pkg, originalIndex }) => {
      const data = packagesData.value?.[originalIndex]
      return {
        name: data?.package.name || pkg,
        version: data?.package.version,
        replacement: replacements.value.get(pkg) ?? null,
      }
    }),
)

// Whether we can add the no-dep column (not already added and have room)
const canAddNoDep = computed(
  () => packages.value.length < maxPackages && !packages.value.includes(NO_DEPENDENCY_ID),
)

// Add "no dependency" column to comparison
function addNoDep() {
  if (packages.value.length >= maxPackages) return
  if (packages.value.includes(NO_DEPENDENCY_ID)) return
  packages.value = [...packages.value, NO_DEPENDENCY_ID]
}

// Get loading state for each column
const columnLoading = computed(() => packages.value.map((_, i) => isColumnLoading(i)))

// Check if we have enough packages to compare
const canCompare = computed(() => packages.value.length >= 2)

const comparisonView = ref<'table' | 'charts'>('table')

// Extract headers from columns for facet rows
const gridHeaders = computed(() =>
  gridColumns.value.map(col => (col.version ? `${col.name}@${col.version}` : col.name)),
)

/*
 * Convert the comparison grid data to a Markdown table.
 */
function exportComparisonDataAsMarkdown() {
  const mdData: Array<Array<string>> = []
  const headers = [
    '',
    ...gridHeaders.value,
    ...(showNoDependency.value ? [$t('compare.no_dependency.label')] : []),
  ]
  mdData.push(headers)
  const maxLengths = headers.map(item => item.length)

  selectedFacets.value.forEach((facet, index) => {
    const label = facet.label
    const data = getFacetValues(facet.id)
    mdData.push([
      label,
      ...data.map(item =>
        item?.type === 'date'
          ? new Date(item.display).toLocaleDateString(locale.value, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : item?.display || '',
      ),
    ])
    mdData?.[index + 1]?.forEach((item, itemIndex) => {
      if (item.length > (maxLengths?.[itemIndex] || 0)) {
        maxLengths[itemIndex] = item.length
      }
    })
  })

  const markdown = mdData.reduce((result, row, index) => {
    // replacing pipe `|` with `ǀ` (U+01C0 Latin Letter Dental Click) to avoid breaking tables
    result += `| ${row
      .map((el, ind) => el.padEnd(maxLengths[ind] || 0, ' ').replace(/\|/g, 'ǀ'))
      .join(' | ')} |`
    if (index === 0) {
      result += `\n|`
      maxLengths.forEach(len => (result += ` ${'-'.padEnd(len, '-')} |`))
    }
    result += `\n`
    return result
  }, '')

  copy(markdown)
}

useSeoMeta({
  title: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_title', { packages: packages.value.join(' vs ') })
      : $t('compare.packages.meta_title_empty'),
  ogTitle: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_title', { packages: packages.value.join(' vs ') })
      : $t('compare.packages.meta_title_empty'),
  twitterTitle: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_title', { packages: packages.value.join(' vs ') })
      : $t('compare.packages.meta_title_empty'),
  description: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_description', { packages: packages.value.join(', ') })
      : $t('compare.packages.meta_description_empty'),
  ogDescription: () =>
    packages.value.length > 0
      ? $t('compare.packages.meta_description', { packages: packages.value.join(', ') })
      : $t('compare.packages.meta_description_empty'),
  twitterDescription: () =>
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
            class="cursor-pointer inline-flex items-center gap-2 p-1.5 -mx-1.5 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
            v-if="canGoBack"
          >
            <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
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
        <ComparePackageSelector v-model="packages" :max="maxPackages" />

        <!-- "No dep" replacement suggestions (native, simple) -->
        <div v-if="noDepSuggestions.length > 0" class="mt-3 space-y-2">
          <CompareReplacementSuggestion
            v-for="suggestion in noDepSuggestions"
            :key="suggestion.forPackage"
            :package-name="suggestion.forPackage"
            :replacement="suggestion.replacement"
            variant="nodep"
            :show-action="canAddNoDep"
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
          <ButtonBase
            size="small"
            :aria-pressed="isAllSelected"
            :disabled="isAllSelected"
            :aria-label="$t('compare.facets.select_all')"
            @click="selectAll"
          >
            {{ $t('compare.facets.all') }}
          </ButtonBase>
          <span class="text-3xs text-fg-muted/40" aria-hidden="true">/</span>
          <ButtonBase
            size="small"
            :aria-pressed="isNoneSelected"
            :disabled="isNoneSelected"
            :aria-label="$t('compare.facets.deselect_all')"
            @click="deselectAll"
          >
            {{ $t('compare.facets.none') }}
          </ButtonBase>
        </div>
        <CompareFacetSelector />
      </section>

      <!-- Comparison grid -->
      <section v-if="canCompare" class="mt-10" aria-labelledby="comparison-heading">
        <CopyToClipboardButton
          v-if="packagesData && packagesData.some(p => p !== null)"
          :copied="copied"
          :copy-text="$t('compare.packages.copy_as_markdown')"
          class="mb-4"
          :button-attrs="{ class: 'hidden md:inline-flex' }"
          @click="exportComparisonDataAsMarkdown"
        >
          <h2 id="comparison-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
            {{ $t('compare.packages.section_comparison') }}
          </h2>
        </CopyToClipboardButton>

        <h2
          v-else
          id="comparison-heading"
          class="text-xs text-fg-subtle uppercase tracking-wider mb-4"
        >
          {{ $t('compare.packages.section_comparison') }}
        </h2>

        <div
          v-if="
            (status === 'pending' || status === 'idle') &&
            (!packagesData || packagesData.every(p => p === null))
          "
          class="flex items-center justify-center py-12"
        >
          <LoadingSpinner :text="$t('compare.packages.loading')" />
        </div>

        <div v-else-if="packagesData && packagesData.some(p => p !== null)">
          <!-- View tabs -->
          <div
            v-if="selectedFacets.some(facet => facet.chartable)"
            class="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-subtle p-0.5 mt-4"
            role="tablist"
            :aria-label="$t('compare.packages.section_comparison')"
          >
            <button
              id="comparison-tab-table"
              type="button"
              role="tab"
              :aria-selected="comparisonView === 'table' ? 'true' : 'false'"
              aria-controls="comparison-panel-table"
              :tabindex="comparisonView === 'table' ? -1 : 0"
              class="flex items-center justify-center gap-x-2 rounded px-3 py-2 font-mono text-sm border border-solid transition-colors duration-150 focus-visible:outline-accent/70"
              :class="
                comparisonView === 'table'
                  ? 'bg-bg border-border shadow-sm text-fg'
                  : 'border-transparent text-fg-subtle hover:text-fg'
              "
              @click="comparisonView = 'table'"
            >
              <span class="i-lucide:table size-[1em]" aria-hidden="true" />
              <span>{{ $t('compare.packages.table_view') }}</span>
            </button>

            <button
              id="comparison-tab-charts"
              type="button"
              role="tab"
              :aria-selected="comparisonView === 'charts' ? 'true' : 'false'"
              aria-controls="comparison-panel-charts"
              :tabindex="comparisonView === 'charts' ? -1 : 0"
              class="flex items-center justify-center gap-x-2 rounded px-3 py-2 font-mono text-sm border border-solid transition-colors duration-150 focus-visible:outline-accent/70"
              :class="
                comparisonView === 'charts'
                  ? 'bg-bg border-border shadow-sm text-fg'
                  : 'border-transparent text-fg-subtle hover:text-fg'
              "
              @click="comparisonView = 'charts'"
            >
              <span class="i-lucide:chart-bar-decreasing size-[1em]" aria-hidden="true" />
              <span>{{ $t('compare.packages.charts_view') }}</span>
            </button>
          </div>

          <!-- Data table -->
          <div v-show="comparisonView === 'table'" role="tabpanel">
            <!-- Desktop: Grid layout -->
            <div class="hidden md:block overflow-x-auto">
              <CompareComparisonGrid :columns="gridColumns" :show-no-dependency="showNoDependency">
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
          </div>

          <!-- bar charts -->
          <div v-if="comparisonView === 'charts'" role="tabpanel">
            <div class="sm:grid grid-cols-2 gap-x-4">
              <div
                v-for="facet in selectedFacets.filter(facet => facet.chartable)"
                :key="facet.id"
                class="my-6"
              >
                <FacetBarChart
                  :values="getFacetValues(facet.id)"
                  :packages="packages.filter(p => p !== NO_DEPENDENCY_ID)"
                  :label="facet.label"
                  :description="facet.description"
                  :facet-loading="isFacetLoading(facet.id)"
                />
              </div>
            </div>
          </div>

          <h2
            id="trends-comparison-heading"
            class="text-xs text-fg-subtle uppercase tracking-wider mb-4 mt-10"
          >
            {{ $t('compare.facets.trends.title') }}
          </h2>

          <CompareLineChart :packages="packages.filter(p => p !== NO_DEPENDENCY_ID)" />
        </div>

        <div v-else-if="status === 'error'" class="text-center py-12" role="alert">
          <p class="text-fg-muted">{{ $t('compare.packages.error') }}</p>
        </div>
        <div v-else class="flex items-center justify-center py-12">
          <LoadingSpinner :text="$t('compare.packages.loading')" />
        </div>
      </section>

      <!-- Empty state -->
      <section
        v-else
        class="text-center px-1.5 py-16 border border-dashed border-border-hover rounded-lg"
      >
        <div
          class="i-lucide:git-compare w-12 h-12 text-fg-subtle mx-auto mb-4"
          aria-hidden="true"
        />
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
