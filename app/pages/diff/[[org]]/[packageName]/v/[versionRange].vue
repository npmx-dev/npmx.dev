<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

definePageMeta({
  name: 'diff',
  path: '/diff/:org?/:packageName/v/:versionRange',
  alias: ['/diff/:packageName/v/:versionRange'],
})

const route = useRoute('diff')

// Derive package name from typed route params
// /diff/nuxt/v/4.0.0...4.2.0           → org: undefined, packageName: "nuxt"
// /diff/@nuxt/kit/v/1.0.0...2.0.0      → org: "@nuxt", packageName: "kit"
const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)

// Parse version range from the typed param (from...to)
const versionRange = computed(() => {
  const parts = route.params.versionRange.split('...')
  if (parts.length !== 2) return null
  return { from: parts[0]!, to: parts[1]! }
})

const fromVersion = computed(() => versionRange.value?.from ?? '')
const toVersion = computed(() => versionRange.value?.to ?? '')

const router = useRouter()
const { data: pkg } = usePackage(packageName)

const { data: compare, status: compareStatus } = useFetch<CompareResponse>(
  () => `/api/registry/compare/${packageName.value}/v/${fromVersion.value}...${toVersion.value}`,
  {
    immediate: !!versionRange.value,
    timeout: 15000,
  },
)

const manualSelection = ref<FileChange | null>(null)
const fileFilter = ref<'all' | 'added' | 'removed' | 'modified'>('all')
const mobileDrawerOpen = ref(false)

const allChanges = computed(() => {
  if (!compare.value) return []
  return [
    ...compare.value.files.added,
    ...compare.value.files.removed,
    ...compare.value.files.modified,
  ].sort((a, b) => a.path.localeCompare(b.path))
})

// Derive selected file: manual selection takes priority, then ?file= query param.
// Using a computed ensures the query-param file is resolved during SSR without
// needing a watcher (which may not re-run before SSR rendering completes).
const selectedFile = computed<FileChange | null>({
  get: () => {
    if (manualSelection.value) return manualSelection.value
    const filePath = route.query.file
    if (!filePath || !compare.value) return null
    return allChanges.value.find(f => f.path === filePath) ?? null
  },
  set: file => {
    manualSelection.value = file
  },
})

if (import.meta.client) {
  watch(
    selectedFile,
    file => {
      const query = { ...route.query }
      if (file?.path) query.file = file.path
      else delete query.file
      router.replace({ query })
    },
    { deep: false },
  )
}

const groupedDeps = computed(() => {
  if (!compare.value?.dependencyChanges) return new Map()

  const groups = new Map<string, typeof compare.value.dependencyChanges>()
  for (const change of compare.value.dependencyChanges) {
    const existing = groups.get(change.section) ?? []
    existing.push(change)
    groups.set(change.section, existing)
  }
  return groups
})
// Keep latestVersion for comparison (to show "(latest)" badge)
const latestVersionDetailed = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const normalizeRoutePath = (routeLocation: RouteLocationRaw) => {
  const resolvedHref = router.resolve(routeLocation).href
  return resolvedHref.replace(/%7B/g, '{').replace(/%7D/g, '}')
}

const fromVersionUrlPattern = computed(() => {
  return normalizeRoutePath(diffRoute(packageName.value, '{version}', toVersion.value))
})
const toVersionUrlPattern = computed(() => {
  return normalizeRoutePath(diffRoute(packageName.value, fromVersion.value, '{version}'))
})

useSeoMeta({
  title: () => {
    if (fromVersion.value && toVersion.value) {
      return `Compare ${packageName.value} ${fromVersion.value}...${toVersion.value} - npmx`
    }
    return `Compare - ${packageName.value} - npmx`
  },
  description: () =>
    `Compare changes between ${packageName.value} versions ${fromVersion.value} and ${toVersion.value}`,
})
</script>

<template>
  <main class="flex-1 flex flex-col min-h-0">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="fromVersion"
      :display-version="pkg?.requestedVersion"
      :latest-version="latestVersionDetailed"
      :version-url-pattern="fromVersionUrlPattern"
      page="diff"
    />

    <!-- Error: invalid route -->
    <div v-if="!versionRange" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">
        {{ $t('compare.invalid_url') }}
      </p>
      <NuxtLink :to="packageRoute(packageName)" class="btn">{{
        $t('compare.go_to_package')
      }}</NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-else-if="compareStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners-ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ $t('compare.comparing_versions') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="compareStatus === 'error'" class="container py-20 text-center" role="alert">
      <p class="text-fg-muted mb-4">{{ $t('compare.failed_to_compare') }}</p>
      <NuxtLink :to="packageRoute(packageName)" class="btn">{{
        $t('compare.back_to_package')
      }}</NuxtLink>
    </div>

    <!-- Comparison content -->
    <div v-else-if="compare" class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      <!-- Desktop sidebar -->
      <aside
        class="hidden md:flex w-80 border-ie border-border bg-bg-subtle flex-col shrink-0 min-h-0"
      >
        <div v-if="pkg?.versions && pkg?.['dist-tags']" class="px-3 py-2 border-b border-border">
          <p class="text-xs font-medium text-fg mb-1 flex items-center gap-1.5">
            <span class="block i-lucide-git-compare-arrows w-3.5 h-3.5" />
            {{ $t('compare.version_selector_title') }}
          </p>
          <VersionSelector
            :package-name="packageName"
            :current-version="toVersion"
            :versions="pkg.versions"
            :dist-tags="pkg['dist-tags']"
            :url-pattern="toVersionUrlPattern"
          />
        </div>
        <DiffSidebarPanel
          :compare="compare"
          :grouped-deps="groupedDeps"
          :all-changes="allChanges"
          v-model:selected-file="selectedFile"
          v-model:file-filter="fileFilter"
          @file-select="selectedFile = $event"
        />
      </aside>

      <!-- Right side -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Mobile summary bar -->
        <div
          class="md:hidden border-b border-border bg-bg-subtle px-4 py-3 flex items-center justify-between gap-3"
        >
          <div class="flex items-center gap-2 text-2xs font-mono text-fg-muted">
            <span class="flex items-center gap-1">
              <span class="text-green-500">+{{ compare.stats.filesAdded }}</span>
              <span class="text-fg-subtle">/</span>
              <span class="text-red-500">-{{ compare.stats.filesRemoved }}</span>
              <span class="text-fg-subtle">/</span>
              <span class="text-yellow-500">~{{ compare.stats.filesModified }}</span>
            </span>
            <span class="text-fg-subtle">•</span>
            <span>{{
              $t('compare.files_count', { count: allChanges.length }, allChanges.length)
            }}</span>
          </div>
          <button
            type="button"
            class="px-2 py-1 inline-flex items-center gap-1.5 font-mono text-xs bg-bg-muted border border-border rounded text-fg-muted hover:text-fg hover:border-border-hover transition-colors"
            @click="mobileDrawerOpen = true"
          >
            <span class="i-lucide:file-text w-3.5 h-3.5" />
            {{ $t('compare.files_button') }}
          </button>
        </div>

        <!-- Diff viewer -->
        <div class="flex-1 overflow-hidden bg-bg-subtle">
          <DiffViewerPanel
            v-if="selectedFile"
            :package-name="packageName"
            :from-version="fromVersion"
            :to-version="toVersion"
            :file="selectedFile"
          />
          <div v-else class="h-full flex items-center justify-center text-center p-8">
            <div>
              <span class="i-lucide:file-text w-16 h-16 mx-auto text-fg-subtle/50 block mb-4" />
              <p class="text-fg-muted">{{ $t('compare.select_file_prompt') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile drawer -->
    <ClientOnly>
      <Teleport to="body">
        <DiffMobileSidebarDrawer
          v-if="compare"
          :compare="compare"
          :grouped-deps="groupedDeps"
          :all-changes="allChanges"
          v-model:selected-file="selectedFile"
          v-model:file-filter="fileFilter"
          v-model:open="mobileDrawerOpen"
          :pkg="pkg"
          :package-name="packageName"
          :to-version="toVersion"
          :to-version-url-pattern="toVersionUrlPattern"
        />
      </Teleport>
    </ClientOnly>
  </main>
</template>
