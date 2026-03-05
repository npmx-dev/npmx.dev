<script setup lang="ts">
import type { CompareResponse, FileChange } from '#shared/types'
import { diffRoute, packageRoute } from '~/utils/router'

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

const fromVersionUrlPattern = computed(() => {
  return router.resolve(diffRoute(packageName.value, '{version}', toVersion.value)).href
})
const toVersionUrlPattern = computed(() => {
  return router.resolve(diffRoute(packageName.value, fromVersion.value, '{version}')).href
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
    <!-- Header -->
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container py-4">
        <!-- Package info -->
        <div class="flex items-center gap-2 mb-3 flex-wrap min-w-0">
          <NuxtLink
            :to="packageRoute(packageName)"
            class="font-mono text-lg font-medium hover:text-fg transition-colors min-w-0 truncate"
          >
            {{ packageName }}
          </NuxtLink>
          <span class="text-fg-subtle">/</span>
          <span class="font-mono text-sm text-fg-muted">compare</span>
        </div>

        <!-- Version selectors -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="text-xs text-fg-subtle uppercase tracking-wide">From</span>
            <VersionSelector
              v-if="pkg?.versions && pkg?.['dist-tags']"
              :package-name="packageName"
              :current-version="fromVersion"
              :versions="pkg.versions"
              :dist-tags="pkg['dist-tags']"
              :url-pattern="fromVersionUrlPattern"
            />
            <span v-else class="font-mono text-sm text-fg-muted">{{ fromVersion }}</span>
          </div>

          <span class="i-lucide:arrow-right w-4 h-4 text-fg-subtle" />

          <div class="flex items-center gap-2">
            <span class="text-xs text-fg-subtle uppercase tracking-wide">To</span>
            <VersionSelector
              v-if="pkg?.versions && pkg?.['dist-tags']"
              :package-name="packageName"
              :current-version="toVersion"
              :versions="pkg.versions"
              :dist-tags="pkg['dist-tags']"
              :url-pattern="toVersionUrlPattern"
            />
            <span v-else class="font-mono text-sm text-fg-muted">{{ toVersion }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Error: invalid route -->
    <div v-if="!versionRange" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">
        Invalid comparison URL. Use format: /diff/package/v/from...to
      </p>
      <NuxtLink :to="packageRoute(packageName)" class="btn">Go to package</NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-else-if="compareStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners-ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">Comparing versions...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="compareStatus === 'error'" class="container py-20 text-center" role="alert">
      <p class="text-fg-muted mb-4">Failed to compare versions</p>
      <NuxtLink :to="packageRoute(packageName)" class="btn">Back to package</NuxtLink>
    </div>

    <!-- Comparison content -->
    <div v-else-if="compare" class="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
      <!-- Desktop sidebar -->
      <aside
        class="hidden md:flex w-80 border-ie border-border bg-bg-subtle flex-col shrink-0 min-h-0"
      >
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
        />
      </Teleport>
    </ClientOnly>
  </main>
</template>
