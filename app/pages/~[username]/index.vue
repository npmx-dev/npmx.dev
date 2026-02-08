<script setup lang="ts">
import { debounce } from 'perfect-debounce'
import { normalizeSearchParam } from '#shared/utils/url'

const route = useRoute('~username')
const router = useRouter()

const username = computed(() => route.params.username)

// Debounced URL update for page and filter/sort
const updateUrl = debounce((updates: { page?: number; filter?: string; sort?: string }) => {
  router.replace({
    query: {
      ...route.query,
      page: updates.page && updates.page > 1 ? updates.page : undefined,
      q: updates.filter || undefined,
      sort: updates.sort && updates.sort !== 'downloads' ? updates.sort : undefined,
    },
  })
}, 300)

type SortOption = 'downloads' | 'updated' | 'name-asc' | 'name-desc'

// Filter and sort state (from URL)
const filterText = shallowRef(normalizeSearchParam(route.query.q))
const sortOption = shallowRef<SortOption>(
  (normalizeSearchParam(route.query.sort) as SortOption) || 'downloads',
)

// Update URL when filter/sort changes (debounced)
const debouncedUpdateUrl = debounce((filter: string, sort: string) => {
  updateUrl({ filter, sort })
}, 300)

// Load all results when user starts filtering/sorting (so client-side filter works on full set)
watch([filterText, sortOption], ([filter, sort]) => {
  if (filter !== '' || sort !== 'downloads') {
    loadAll()
  }
  debouncedUpdateUrl(filter, sort)
})

// Fetch packages (composable manages pagination & provider dispatch internally)
const {
  data: results,
  status,
  error,
  isLoadingMore,
  hasMore,
  loadMore,
  loadAll,
  pageSize,
} = useUserPackages(username)

// Get initial page from URL (for scroll restoration on reload)
const initialPage = computed(() => {
  const p = Number.parseInt(normalizeSearchParam(route.query.page), 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Get the base packages list
const packages = computed(() => results.value?.objects ?? [])

const packageCount = computed(() => packages.value.length)

// Apply client-side filter and sort
const filteredAndSortedPackages = computed(() => {
  let pkgs = [...packages.value]

  // Apply text filter
  if (filterText.value) {
    const search = filterText.value.toLowerCase()
    pkgs = pkgs.filter(
      pkg =>
        pkg.package.name.toLowerCase().includes(search) ||
        pkg.package.description?.toLowerCase().includes(search),
    )
  }

  // Apply sort
  switch (sortOption.value) {
    case 'updated':
      pkgs.sort((a, b) => {
        const dateA = a.package.date || ''
        const dateB = b.package.date || ''
        return dateB.localeCompare(dateA)
      })
      break
    case 'name-asc':
      pkgs.sort((a, b) => a.package.name.localeCompare(b.package.name))
      break
    case 'name-desc':
      pkgs.sort((a, b) => b.package.name.localeCompare(a.package.name))
      break
    case 'downloads':
    default:
      pkgs.sort((a, b) => (b.downloads?.weekly ?? 0) - (a.downloads?.weekly ?? 0))
      break
  }

  return pkgs
})

const filteredCount = computed(() => filteredAndSortedPackages.value.length)

// Total weekly downloads across displayed packages (updates with filter)
const totalWeeklyDownloads = computed(() =>
  filteredAndSortedPackages.value.reduce((sum, pkg) => sum + (pkg.downloads?.weekly ?? 0), 0),
)

// Update URL when page changes from scrolling
function handlePageChange(page: number) {
  updateUrl({ page, filter: filterText.value, sort: sortOption.value })
}

// Reset state when username changes
watch(username, () => {
  filterText.value = ''
  sortOption.value = 'downloads'
})

useSeoMeta({
  title: () => `~${username.value} - npmx`,
  ogTitle: () => `~${username.value} - npmx`,
  twitterTitle: () => `~${username.value} - npmx`,
  description: () => `npm packages maintained by ${username.value}`,
  ogDescription: () => `npm packages maintained by ${username.value}`,
  twitterDescription: () => `npm packages maintained by ${username.value}`,
})

defineOgImageComponent('Default', {
  title: () => `~${username.value}`,
  description: () => (results.value ? `${results.value.total} packages` : 'npm user profile'),
  primaryColor: '#60a5fa',
})
</script>

<template>
  <main class="container flex-1 flex flex-col py-8 sm:py-12 w-full">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex flex-wrap items-center gap-4">
        <UserAvatar :username="username" />
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">~{{ username }}</h1>
          <p v-if="results?.total" class="text-fg-muted text-sm mt-1">
            {{ $t('org.public_packages', { count: $n(results.total) }, results.total) }}
          </p>
        </div>

        <!-- Link to npmjs.com profile + vanity downloads -->
        <div class="ms-auto text-end">
          <nav aria-label="External links">
            <a
              :href="`https://www.npmjs.com/~${username}`"
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

    <!-- Loading state -->
    <LoadingSpinner
      v-if="status === 'pending' && packages.length === 0"
      :text="$t('common.loading_packages')"
    />

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-12 text-center">
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? $t('user.page.failed_to_load') }}
      </p>
      <LinkBase variant="button-secondary" :to="{ name: 'index' }">{{
        $t('common.go_back_home')
      }}</LinkBase>
    </div>

    <!-- Package list -->
    <section v-else-if="packages.length > 0">
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        {{ $t('user.page.packages_title') }}
      </h2>

      <!-- Filter and sort controls -->
      <PackageListControls
        v-model:filter="filterText"
        v-model:sort="sortOption"
        :placeholder="$t('user.page.filter_placeholder', { count: results?.total ?? 0 })"
        :total-count="packageCount"
        :filtered-count="filteredCount"
      />

      <!-- No results after filtering -->
      <p
        v-if="filteredAndSortedPackages.length === 0"
        class="text-fg-muted py-8 text-center font-mono"
      >
        {{ $t('user.page.no_match', { query: filterText }) }}
      </p>

      <PackageList
        v-else
        :results="filteredAndSortedPackages"
        :has-more="hasMore"
        :is-loading="isLoadingMore"
        :page-size="pageSize"
        :initial-page="initialPage"
        @load-more="loadMore"
        @page-change="handlePageChange"
      />
    </section>

    <!-- Empty state (no packages found for user) -->
    <div v-else-if="status === 'success'" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <p class="text-fg-muted font-mono">
          {{ $t('user.page.no_packages') }} <span class="text-fg">~{{ username }}</span>
        </p>
        <p class="text-fg-subtle text-sm mt-2">{{ $t('user.page.no_packages_hint') }}</p>
      </div>
    </div>
  </main>
</template>
