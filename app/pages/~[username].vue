<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'

const route = useRoute('~username')
const router = useRouter()

const username = computed(() => route.params.username)

// Infinite scroll state
const pageSize = 50
const loadedPages = ref(1)
const isLoadingMore = ref(false)

// Get initial page from URL (for scroll restoration on reload)
const initialPage = computed(() => {
  const p = Number.parseInt(route.query.page as string, 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Debounced URL update for page
const updateUrlPage = debounce((page: number) => {
  router.replace({
    query: {
      ...route.query,
      page: page > 1 ? page : undefined,
    },
  })
}, 500)

// Search for packages by this maintainer
const searchQuery = computed(() => `maintainer:${username.value}`)

const {
  data: results,
  status,
  error,
} = useNpmSearch(searchQuery, () => ({
  size: pageSize * loadedPages.value,
}))

// Initialize loaded pages from URL on mount
onMounted(() => {
  if (initialPage.value > 1) {
    loadedPages.value = initialPage.value
  }
})

// Sort packages by downloads/popularity (searchScore is a good proxy)
const sortedPackages = computed(() => {
  if (!results.value?.objects) return []
  return [...results.value.objects].sort((a, b) => b.searchScore - a.searchScore)
})

// Check if there are potentially more results
const hasMore = computed(() => {
  if (!results.value) return false
  // npm search API returns max 250 results, but we paginate for faster initial load
  return (
    results.value.objects.length >= pageSize * loadedPages.value &&
    loadedPages.value * pageSize < 250
  )
})

function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  loadedPages.value++

  nextTick(() => {
    isLoadingMore.value = false
  })
}

// Update URL when page changes from scrolling
function handlePageChange(page: number) {
  updateUrlPage(page)
}

// Reset pagination when username changes
watch(username, () => {
  loadedPages.value = 1
})

useSeoMeta({
  title: () => `@${username.value} - npmx`,
  description: () => `npm packages maintained by ${username.value}`,
})

defineOgImageComponent('Default', {
  title: () => `@${username.value}`,
  description: () => (results.value ? `${results.value.total} packages` : 'npm user profile'),
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex items-center gap-4 mb-4">
        <!-- Avatar placeholder -->
        <div
          class="w-16 h-16 rounded-full bg-bg-muted border border-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-2xl text-fg-subtle font-mono">{{
            username.charAt(0).toUpperCase()
          }}</span>
        </div>
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">@{{ username }}</h1>
          <p v-if="results?.total" class="text-fg-muted text-sm mt-1">
            {{ formatNumber(results.total) }} public package{{ results.total === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <!-- Link to npmjs.com profile -->
      <nav aria-label="External links">
        <a
          :href="`https://www.npmjs.com/~${username}`"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
        >
          <span class="i-carbon-cube w-4 h-4" />
          view on npm
        </a>
      </nav>
    </header>

    <!-- Loading state -->
    <LoadingSpinner v-if="status === 'pending' && loadedPages === 1" text="Loading packages..." />

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-12 text-center">
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? 'Failed to load user packages' }}
      </p>
      <NuxtLink to="/" class="btn"> Go back home </NuxtLink>
    </div>

    <!-- Empty state -->
    <div v-else-if="results && results.total === 0" class="py-12 text-center">
      <p class="text-fg-muted font-mono">
        No public packages found for <span class="text-fg">@{{ username }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">This user may not exist or has no public packages.</p>
    </div>

    <!-- Package list -->
    <section v-else-if="results && sortedPackages.length > 0" aria-label="User packages">
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">Packages</h2>

      <PackageList
        :results="sortedPackages"
        :has-more="hasMore"
        :is-loading="isLoadingMore || (status === 'pending' && loadedPages > 1)"
        :page-size="pageSize"
        :initial-page="initialPage"
        @load-more="loadMore"
        @page-change="handlePageChange"
      />
    </section>
  </main>
</template>
