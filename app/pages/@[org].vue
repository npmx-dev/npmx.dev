<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'

definePageMeta({
  name: 'org',
  alias: ['/org/:org()'],
})

const route = useRoute('org')
const router = useRouter()

const orgName = computed(() => route.params.org)

const { isConnected } = useConnector()

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

// Search for packages in this org's scope (@orgname/*)
const searchQuery = computed(() => `@${orgName.value}`)

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

// Filter to only include packages that are actually in this scope
// (search may return packages that just mention the org name)
const scopedPackages = computed(() => {
  if (!results.value?.objects) return []
  const scopePrefix = `@${orgName.value}/`
  return results.value.objects
    .filter(obj => obj.package.name.startsWith(scopePrefix))
    .sort((a, b) => b.searchScore - a.searchScore)
})

const packageCount = computed(() => scopedPackages.value.length)

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

// Reset pagination when org changes
watch(orgName, () => {
  loadedPages.value = 1
})

const activeTab = ref<'members' | 'teams'>('members')

// Canonical URL for this org page
const canonicalUrl = computed(() => `https://npmx.dev/@${orgName.value}`)

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: () => `@${orgName.value} - npmx`,
  description: () => `npm packages published by the ${orgName.value} organization`,
})

defineOgImageComponent('Default', {
  title: () => `@${orgName.value}`,
  description: () =>
    scopedPackages.value.length ? `${scopedPackages.value.length} packages` : 'npm organization',
})
</script>

<template>
  <main class="container py-8 sm:py-12">
    <!-- Header -->
    <header class="mb-8 pb-8 border-b border-border">
      <div class="flex items-center gap-4 mb-4">
        <!-- Org avatar placeholder -->
        <div
          class="w-16 h-16 rounded-lg bg-bg-muted border border-border flex items-center justify-center"
          aria-hidden="true"
        >
          <span class="text-2xl text-fg-subtle font-mono">{{
            orgName.charAt(0).toUpperCase()
          }}</span>
        </div>
        <div>
          <h1 class="font-mono text-2xl sm:text-3xl font-medium">@{{ orgName }}</h1>
          <p v-if="status === 'success'" class="text-fg-muted text-sm mt-1">
            {{ formatNumber(packageCount) }} public package{{ packageCount === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <!-- Link to npmjs.com org page -->
      <nav aria-label="External links">
        <a
          :href="`https://www.npmjs.com/org/${orgName}`"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
        >
          <span class="i-carbon-cube w-4 h-4" />
          view on npm
        </a>
      </nav>
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
            Members
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
            Teams
          </button>
        </div>

        <!-- Tab content -->
        <OrgMembersPanel v-if="activeTab === 'members'" :org-name="orgName" />
        <OrgTeamsPanel v-else :org-name="orgName" />
      </section>
    </ClientOnly>

    <!-- Loading state -->
    <LoadingSpinner v-if="status === 'pending' && loadedPages === 1" text="Loading packages..." />

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-12 text-center">
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? 'Failed to load organization packages' }}
      </p>
      <NuxtLink to="/" class="btn"> Go back home </NuxtLink>
    </div>

    <!-- Empty state -->
    <div v-else-if="packageCount === 0" class="py-12 text-center">
      <p class="text-fg-muted font-mono">
        No public packages found for <span class="text-fg">@{{ orgName }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">
        This organization may not exist or has no public packages.
      </p>
    </div>

    <!-- Package list -->
    <section v-else-if="scopedPackages.length > 0" aria-label="Organization packages">
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">Packages</h2>

      <PackageList
        :results="scopedPackages"
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
