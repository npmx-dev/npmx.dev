<script setup lang="ts">
import type { FilterChip, SortOption } from '#shared/types/preferences'
import { normalizeSearchParam } from '#shared/utils/url'
import { debounce } from 'perfect-debounce'

definePageMeta({
  name: 'org',
})

const route = useRoute('org')
const router = useRouter()

const orgName = computed(() => route.params.org)

const { isConnected } = useConnector()

// Fetch all packages in this org using the org packages API (lazy to not block navigation)
const { data: results, status, error } = useOrgPackages(orgName)

// Handle 404 errors reactively (since we're not awaiting)
watch(
  [status, error],
  ([newStatus, newError]) => {
    if (newStatus === 'error' && newError?.statusCode === 404) {
      showError({
        statusCode: 404,
        statusMessage: $t('org.page.not_found'),
        message: $t('org.page.not_found_message', { name: orgName.value }),
      })
    }
  },
  { immediate: true },
)

const packages = computed(() => results.value?.objects ?? [])
const packageCount = computed(() => packages.value.length)

// Preferences (persisted to localStorage)
const { viewMode, paginationMode, pageSize, columns, toggleColumn, resetColumns } =
  usePackageListPreferences()

// Structured filters and sorting
const {
  filters,
  sortOption,
  sortedPackages,
  availableKeywords,
  activeFilters,
  setTextFilter,
  setSearchScope,
  setDownloadRange,
  setSecurity,
  setUpdatedWithin,
  toggleKeyword,
  clearFilter,
  clearAllFilters,
  setSort,
} = useStructuredFilters({
  packages,
  initialFilters: {
    ...parseSearchOperators(normalizeSearchParam(route.query.q)),
  },
  initialSort: (normalizeSearchParam(route.query.sort) as SortOption) ?? 'updated-desc',
})

// Pagination state
const currentPage = shallowRef(1)

// Calculate total pages
const totalPages = computed(() => {
  if (pageSize.value === 'all') return 1
  const numericSize = typeof pageSize.value === 'number' ? pageSize.value : 25
  return Math.ceil(sortedPackages.value.length / numericSize)
})

// Reset to page 1 when filters change
watch([filters, sortOption], () => {
  currentPage.value = 1
})

// Clamp current page when total pages decreases (e.g., after filtering)
watch(totalPages, newTotal => {
  if (currentPage.value > newTotal && newTotal > 0) {
    currentPage.value = newTotal
  }
})

// Debounced URL update for filter/sort
const updateUrl = debounce((updates: { filter?: string; sort?: string }) => {
  router.replace({
    query: {
      ...route.query,
      q: updates.filter || undefined,
      sort: updates.sort && updates.sort !== 'updated-desc' ? updates.sort : undefined,
    },
  })
}, 300)

// Update URL when filter/sort changes (debounced)
watch(
  [() => filters.value.text, () => filters.value.keywords, () => sortOption.value] as const,
  ([text, keywords, sort]) => {
    const filter = [text, ...keywords.map(keyword => `keyword:${keyword}`)]
      .filter(Boolean)
      .join(' ')
    updateUrl({ filter, sort })
  },
)

const filteredCount = computed(() => sortedPackages.value.length)

// Total weekly downloads across displayed packages (updates with filter)
const totalWeeklyDownloads = computed(() =>
  sortedPackages.value.reduce((sum, pkg) => sum + (pkg.downloads?.weekly ?? 0), 0),
)

// Reset state when org changes
watch(orgName, () => {
  clearAllFilters()
  setSort('updated-desc')
  currentPage.value = 1
})

// Handle filter chip removal
function handleClearFilter(chip: FilterChip) {
  clearFilter(chip)
}

const activeTab = shallowRef<'members' | 'teams'>('members')

// Canonical URL for this org page
const canonicalUrl = computed(() => `https://npmx.dev/@${orgName.value}`)

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: () => `@${orgName.value} - npmx`,
  ogTitle: () => `@${orgName.value} - npmx`,
  twitterTitle: () => `@${orgName.value} - npmx`,
  description: () => `npm packages published by the ${orgName.value} organization`,
  ogDescription: () => `npm packages published by the ${orgName.value} organization`,
  twitterDescription: () => `npm packages published by the ${orgName.value} organization`,
})

defineOgImageComponent('Default', {
  title: () => `@${orgName.value}`,
  description: () => (packageCount.value ? `${packageCount.value} packages` : 'npm organization'),
  primaryColor: '#60a5fa',
})
</script>

<template>
  <main class="container flex-1 py-8 sm:py-12 w-full">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-wrap items-end gap-4">
        <!-- Org avatar placeholder -->
        <div
          class="size-16 shrink-0 rounded-lg bg-bg-muted border border-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-2xl text-fg-subtle font-mono">{{
            orgName.charAt(0).toUpperCase()
          }}</span>
        </div>
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">@{{ orgName }}</h1>
          <p v-if="status === 'success'" class="text-fg-muted text-sm mt-1">
            {{ $t('org.public_packages', { count: $n(packageCount) }, packageCount) }}
          </p>
        </div>

        <!-- Link to npmjs.com org page + vanity downloads -->
        <div class="ms-auto text-end">
          <nav aria-label="External links">
            <a
              :href="`https://www.npmjs.com/org/${orgName}`"
              target="_blank"
              rel="noopener noreferrer"
              class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
              :title="$t('common.view_on_npm')"
            >
              <span class="i-carbon:logo-npm w-4 h-4" aria-hidden="true" />
              npm
            </a>
          </nav>
          <p
            class="text-fg-subtle text-xs mt-1 flex items-center gap-1.5 justify-end cursor-help"
            :title="$t('common.vanity_downloads_hint', { count: filteredCount }, filteredCount)"
          >
            <span class="i-carbon:chart-line w-3.5 h-3.5" aria-hidden="true" />
            <span class="font-mono"
              >{{ $n(totalWeeklyDownloads) }} {{ $t('common.per_week') }}</span
            >
          </p>
        </div>
      </div>
    </header>

    <!-- Admin panels (when connected) -->
    <ClientOnly>
      <section v-if="isConnected" class="mb-8" aria-label="Organization management">
        <!-- Tab buttons -->
        <div class="flex items-center gap-1 mb-4">
          <button
            type="button"
            class="px-4 py-2 font-mono text-sm rounded-t-lg transition-colors duration-200"
            :class="
              activeTab === 'members'
                ? 'bg-bg-subtle text-fg border border-border border-b-0'
                : 'text-fg-muted hover:text-fg'
            "
            @click="activeTab = 'members'"
          >
            {{ $t('org.page.members_tab') }}
          </button>
          <button
            type="button"
            class="px-4 py-2 font-mono text-sm rounded-t-lg transition-colors duration-200"
            :class="
              activeTab === 'teams'
                ? 'bg-bg-subtle text-fg border border-border border-b-0'
                : 'text-fg-muted hover:text-fg'
            "
            @click="activeTab = 'teams'"
          >
            {{ $t('org.page.teams_tab') }}
          </button>
        </div>

        <!-- Tab content -->
        <OrgMembersPanel v-if="activeTab === 'members'" :org-name="orgName" />
        <OrgTeamsPanel v-else :org-name="orgName" />
      </section>
    </ClientOnly>

    <!-- Loading state -->
    <LoadingSpinner v-if="status === 'pending'" :text="$t('common.loading_packages')" />

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-12 text-center">
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? $t('org.page.failed_to_load') }}
      </p>
      <LinkBase variant="button-secondary" :to="{ name: 'index' }">{{
        $t('common.go_back_home')
      }}</LinkBase>
    </div>

    <!-- Empty state -->
    <div v-else-if="packageCount === 0" class="py-12 text-center">
      <p class="text-fg-muted font-mono">
        {{ $t('org.page.no_packages') }} <span class="text-fg">@{{ orgName }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">
        {{ $t('org.page.no_packages_hint') }}
      </p>
    </div>

    <!-- Package list -->
    <section v-else-if="packages.length > 0" :aria-label="$t('org.page.packages_title')">
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        {{ $t('org.page.packages_title') }}
      </h2>

      <!-- Enhanced toolbar with filters -->
      <PackageListToolbar
        :filters="filters"
        v-model:sort-option="sortOption"
        v-model:view-mode="viewMode"
        :columns="columns"
        v-model:pagination-mode="paginationMode"
        v-model:page-size="pageSize"
        :total-count="packageCount"
        :filtered-count="filteredCount"
        :available-keywords="availableKeywords"
        :active-filters="activeFilters"
        @toggle-column="toggleColumn"
        @reset-columns="resetColumns"
        @clear-filter="handleClearFilter"
        @clear-all-filters="clearAllFilters"
        @update:text="setTextFilter"
        @update:search-scope="setSearchScope"
        @update:download-range="setDownloadRange"
        @update:security="setSecurity"
        @update:updated-within="setUpdatedWithin"
        @toggle-keyword="toggleKeyword"
      />

      <!-- No results after filtering -->
      <p v-if="sortedPackages.length === 0" class="text-fg-muted py-8 text-center font-mono">
        {{ $t('org.page.no_match', { query: filters.text }) }}
      </p>

      <!-- Package list with view mode support -->
      <template v-else>
        <PackageList
          :results="sortedPackages"
          :view-mode="viewMode"
          :columns="columns"
          :filters="filters"
          v-model:sort-option="sortOption"
          :pagination-mode="paginationMode"
          :page-size="pageSize"
          :current-page="currentPage"
          @click-keyword="toggleKeyword"
        />

        <!-- Pagination controls -->
        <PaginationControls
          v-model:mode="paginationMode"
          v-model:page-size="pageSize"
          v-model:current-page="currentPage"
          :total-items="sortedPackages.length"
          :view-mode="viewMode"
        />
      </template>
    </section>
  </main>
</template>
