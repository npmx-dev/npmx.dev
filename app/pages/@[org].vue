<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'

const { t } = useI18n()

definePageMeta({
  name: 'org',
  alias: ['/org/:org()'],
})

const route = useRoute('org')
const router = useRouter()

const orgName = computed(() => route.params.org)

const { isConnected } = useConnector()

// Debounced URL update for filter/sort
const updateUrl = debounce((updates: { filter?: string; sort?: string }) => {
  router.replace({
    query: {
      ...route.query,
      q: updates.filter || undefined,
      sort: updates.sort && updates.sort !== 'downloads' ? updates.sort : undefined,
    },
  })
}, 300)

type SortOption = 'downloads' | 'updated' | 'name-asc' | 'name-desc'

// Filter and sort state (from URL)
const filterText = ref((route.query.q as string) ?? '')
const sortOption = ref<SortOption>((route.query.sort as SortOption) || 'downloads')

// Update URL when filter/sort changes (debounced)
watch([filterText, sortOption], ([filter, sort]) => {
  updateUrl({ filter, sort })
})

// Fetch all packages in this org using the org packages API
const { data: results, status, error } = await useOrgPackages(orgName)

if (status.value === 'error' && error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Organization not found',
    message: `The organization "@${orgName.value}" does not exist on npm`,
  })
}

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
        const dateA = a.updated || a.package.date || ''
        const dateB = b.updated || b.package.date || ''
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

// Reset state when org changes
watch(orgName, () => {
  filterText.value = ''
  sortOption.value = 'downloads'
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
  description: () => (packageCount.value ? `${packageCount.value} packages` : 'npm organization'),
})
</script>

<template>
  <main class="container py-8 sm:py-12 w-full">
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
            {{ t('org.public_packages', { count: formatNumber(packageCount) }, packageCount) }}
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
          {{ t('common.view_on_npm') }}
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
            {{ t('org.page.members_tab') }}
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
            {{ t('org.page.teams_tab') }}
          </button>
        </div>

        <!-- Tab content -->
        <OrgMembersPanel v-if="activeTab === 'members'" :org-name="orgName" />
        <OrgTeamsPanel v-else :org-name="orgName" />
      </section>
    </ClientOnly>

    <!-- Loading state -->
    <LoadingSpinner v-if="status === 'pending'" :text="t('common.loading_packages')" />

    <!-- Error state -->
    <div v-else-if="status === 'error'" role="alert" class="py-12 text-center">
      <p class="text-fg-muted mb-4">
        {{ error?.message ?? t('org.page.failed_to_load') }}
      </p>
      <NuxtLink to="/" class="btn">{{ t('common.go_back_home') }}</NuxtLink>
    </div>

    <!-- Empty state -->
    <div v-else-if="packageCount === 0" class="py-12 text-center">
      <p class="text-fg-muted font-mono">
        {{ t('org.page.no_packages') }} <span class="text-fg">@{{ orgName }}</span>
      </p>
      <p class="text-fg-subtle text-sm mt-2">
        {{ t('org.page.no_packages_hint') }}
      </p>
    </div>

    <!-- Package list -->
    <section v-else-if="packages.length > 0" :aria-label="t('org.page.packages_title')">
      <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-4">
        {{ t('org.page.packages_title') }}
      </h2>

      <!-- Filter and sort controls -->
      <PackageListControls
        v-model:filter="filterText"
        v-model:sort="sortOption"
        :placeholder="`Filter ${packageCount} packages...`"
        :total-count="packageCount"
        :filtered-count="filteredCount"
      />

      <!-- No results after filtering -->
      <p
        v-if="filteredAndSortedPackages.length === 0"
        class="text-fg-muted py-8 text-center font-mono"
      >
        {{ t('org.page.no_match', { query: filterText }) }}
      </p>

      <PackageList v-else :results="filteredAndSortedPackages" />
    </section>
  </main>
</template>
