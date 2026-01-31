<script setup lang="ts">
import type { CompareResponse, FileChange } from '#shared/types'
import { getFileIcon } from '~/utils/file-icons'

definePageMeta({
  name: 'diff',
})

const route = useRoute('diff')

// Parse package name and version range from URL
// Patterns:
// -  /diff/nuxt/v/4.0.0...4.2.0
// -  /diff/@nuxt/kit/v/1.0.0...2.0.0
const parsedRoute = computed(() => {
  const segments = route.params.path || []

  // Find the /v/ separator
  const vIndex = segments.indexOf('v')
  if (vIndex === -1 || vIndex >= segments.length - 1) {
    return { packageName: segments.join('/'), range: null }
  }

  const packageName = segments.slice(0, vIndex).join('/')
  const rangeStr = segments[vIndex + 1] ?? ''

  // Parse version range (from...to)
  const parts = rangeStr.split('...')
  if (parts.length !== 2) {
    return { packageName, range: null }
  }

  return {
    packageName,
    range: { from: parts[0]!, to: parts[1]! },
  }
})

const packageName = computed(() => parsedRoute.value.packageName)
const fromVersion = computed(() => parsedRoute.value.range?.from ?? '')
const toVersion = computed(() => parsedRoute.value.range?.to ?? '')

const router = useRouter()
const initializedFromQuery = ref(false)
const { data: pkg } = usePackage(packageName)

const { data: compare, status: compareStatus } = useFetch<CompareResponse>(
  () => `/api/registry/compare/${packageName.value}/v/${fromVersion.value}...${toVersion.value}`,
  {
    immediate: !!parsedRoute.value.range,
    timeout: 15000,
  },
)

const selectedFile = ref<FileChange | null>(null)
const fileFilter = ref<'all' | 'added' | 'removed' | 'modified'>('all')

const allChanges = computed(() => {
  if (!compare.value) return []
  return [
    ...compare.value.files.added,
    ...compare.value.files.removed,
    ...compare.value.files.modified,
  ].sort((a, b) => a.path.localeCompare(b.path))
})

const filteredChanges = computed(() => {
  if (fileFilter.value === 'all') return allChanges.value
  return allChanges.value.filter(f => f.type === fileFilter.value)
})

// Sync selection with ?file= query for shareable links
watch(
  [() => route.query.file, compare],
  ([filePath]) => {
    if (initializedFromQuery.value || !filePath || !compare.value) return
    const match = allChanges.value.find(f => f.path === filePath)
    if (match) {
      selectedFile.value = match
      initializedFromQuery.value = true
    }
  },
  { immediate: true },
)

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

function formatSection(section: string): string {
  switch (section) {
    case 'dependencies':
      return 'Dependencies'
    case 'devDependencies':
      return 'Dev Dependencies'
    case 'peerDependencies':
      return 'Peer Dependencies'
    case 'optionalDependencies':
      return 'Optional Dependencies'
    default:
      return section
  }
}

function getSemverBadgeClass(semverDiff: string | null | undefined): string {
  switch (semverDiff) {
    case 'major':
      return 'bg-red-500/10 text-red-500'
    case 'minor':
      return 'bg-yellow-500/10 text-yellow-500'
    case 'patch':
      return 'bg-green-500/10 text-green-500'
    case 'prerelease':
      return 'bg-purple-500/10 text-purple-500'
    default:
      return 'bg-bg-muted text-fg-subtle'
  }
}

function getChangeIcon(type: FileChange['type']): string {
  switch (type) {
    case 'added':
      return 'i-carbon-add-alt text-green-500'
    case 'removed':
      return 'i-carbon-subtract-alt text-red-500'
    case 'modified':
      return 'i-carbon-edit text-yellow-500'
  }
}

const fromVersionUrlPattern = computed(() => {
  return `/diff/${packageName.value}/v/{version}...${toVersion.value}`
})
const toVersionUrlPattern = computed(() => {
  return `/diff/${packageName.value}/v/${fromVersion.value}...{version}`
})

function packageRoute(ver?: string | null) {
  const segments = packageName.value.split('/')
  if (ver) segments.push('v', ver)
  return { name: 'package' as const, params: { package: segments } }
}

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
            :to="packageRoute()"
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

          <span class="i-carbon-arrow-right w-4 h-4 text-fg-subtle" />

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
    <div v-if="!parsedRoute.range" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">
        Invalid comparison URL. Use format: /diff/package/v/from...to
      </p>
      <NuxtLink :to="packageRoute()" class="btn">Go to package</NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-else-if="compareStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners-ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">Comparing versions...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="compareStatus === 'error'" class="container py-20 text-center" role="alert">
      <p class="text-fg-muted mb-4">Failed to compare versions</p>
      <NuxtLink :to="packageRoute()" class="btn">Back to package</NuxtLink>
    </div>

    <!-- Comparison content - 2 column layout -->
    <div v-else-if="compare" class="flex-1 flex min-h-0 overflow-hidden">
      <!-- Left sidebar: Summary + File browser -->
      <aside class="w-80 border-r border-border bg-bg-subtle flex flex-col shrink-0">
        <!-- Summary section -->
        <div class="border-b border-border shrink-0">
          <!-- Header with stats -->
          <div class="px-3 py-2.5 border-b border-border">
            <div class="flex items-center justify-between">
              <h2 class="text-xs font-medium">Summary</h2>
              <div class="flex items-center gap-3 font-mono text-[10px]">
                <span class="flex items-center gap-1">
                  <span class="text-green-500">+{{ compare.stats.filesAdded }}</span>
                  <span class="text-fg-subtle">/</span>
                  <span class="text-red-500">-{{ compare.stats.filesRemoved }}</span>
                  <span class="text-fg-subtle">/</span>
                  <span class="text-yellow-500">~{{ compare.stats.filesModified }}</span>
                </span>
                <span v-if="compare.dependencyChanges.length > 0" class="text-fg-muted">
                  {{ compare.dependencyChanges.length }} dep{{
                    compare.dependencyChanges.length !== 1 ? 's' : ''
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- Warnings -->
          <div
            v-if="compare.meta.warnings?.length"
            class="px-3 py-2 bg-yellow-500/5 border-b border-border"
          >
            <div class="flex items-start gap-2">
              <span class="i-carbon-warning w-3.5 h-3.5 text-yellow-500 shrink-0 mt-0.5" />
              <div class="text-[10px] text-fg-muted">
                <p v-for="warning in compare.meta.warnings" :key="warning">{{ warning }}</p>
              </div>
            </div>
          </div>

          <!-- Dependency changes -->
          <div v-if="compare.dependencyChanges.length > 0" class="px-3 py-2.5">
            <details class="group">
              <summary
                class="cursor-pointer list-none flex items-center gap-2 text-xs font-medium mb-2 hover:text-fg transition-colors"
              >
                <span
                  class="i-carbon-chevron-right w-3.5 h-3.5 transition-transform group-open:rotate-90"
                />
                <span class="i-carbon-cube w-3.5 h-3.5" />
                Dependencies ({{ compare.dependencyChanges.length }})
              </summary>

              <div class="space-y-2 ml-5 max-h-40 overflow-y-auto">
                <div v-for="[section, changes] in groupedDeps" :key="section">
                  <div
                    class="text-[10px] font-medium text-fg-subtle uppercase tracking-wide mb-1.5"
                  >
                    {{ formatSection(section) }}
                  </div>
                  <div class="space-y-1">
                    <div
                      v-for="dep in changes"
                      :key="dep.name"
                      class="flex items-center gap-2 text-xs py-0.5"
                    >
                      <!-- Change type icon -->
                      <span
                        :class="[
                          'w-3 h-3 shrink-0',
                          dep.type === 'added'
                            ? 'i-carbon-add-alt text-green-500'
                            : dep.type === 'removed'
                              ? 'i-carbon-subtract-alt text-red-500'
                              : 'i-carbon-arrows-horizontal text-yellow-500',
                        ]"
                      />

                      <!-- Package name -->
                      <NuxtLink
                        :to="`/${dep.name}`"
                        class="font-mono hover:text-fg transition-colors truncate min-w-0"
                      >
                        {{ dep.name }}
                      </NuxtLink>

                      <!-- Version change -->
                      <div
                        class="flex items-center gap-1.5 text-fg-muted font-mono text-[10px] ml-auto shrink-0"
                      >
                        <span
                          v-if="dep.from"
                          :class="{ 'line-through opacity-50': dep.type === 'updated' }"
                        >
                          {{ dep.from }}
                        </span>
                        <span
                          v-if="dep.type === 'updated'"
                          class="i-carbon-arrow-right w-2.5 h-2.5"
                        />
                        <span v-if="dep.to">{{ dep.to }}</span>
                      </div>

                      <!-- Semver badge -->
                      <span
                        v-if="dep.semverDiff"
                        class="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        :class="getSemverBadgeClass(dep.semverDiff)"
                      >
                        {{ dep.semverDiff }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <!-- Empty state -->
          <div
            v-if="compare.dependencyChanges.length === 0 && !compare.meta.warnings?.length"
            class="px-3 py-2 text-[10px] text-fg-muted text-center"
          >
            No dependency changes
          </div>
        </div>

        <!-- File browser collapsible -->
        <details class="flex-1 flex flex-col open:flex-1 group" open>
          <summary
            class="border-b border-border px-3 py-2 shrink-0 bg-bg-muted cursor-pointer list-none flex items-center justify-between gap-2"
          >
            <span class="text-xs font-medium flex items-center gap-1.5">
              <span class="i-carbon-document w-3.5 h-3.5" />
              Changed Files
            </span>
            <span class="flex items-center gap-2">
              <select
                v-model="fileFilter"
                class="text-[10px] px-2 py-1 bg-bg-subtle border border-border rounded font-mono cursor-pointer hover:border-border-hover transition-colors"
              >
                <option value="all">All ({{ allChanges.length }})</option>
                <option value="added">Added ({{ compare.stats.filesAdded }})</option>
                <option value="removed">Removed ({{ compare.stats.filesRemoved }})</option>
                <option value="modified">Modified ({{ compare.stats.filesModified }})</option>
              </select>
              <span
                class="i-carbon-chevron-right w-3.5 h-3.5 transition-transform group-open:rotate-90"
              />
            </span>
          </summary>

          <!-- File list (scrollable) -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <div v-if="filteredChanges.length === 0" class="p-8 text-center text-xs text-fg-muted">
              No {{ fileFilter === 'all' ? '' : fileFilter }} files
            </div>

            <nav v-else class="divide-y divide-border">
              <button
                v-for="file in filteredChanges"
                :key="file.path"
                type="button"
                class="w-full px-3 py-2 flex items-center gap-2 text-sm text-left hover:bg-bg-muted transition-colors group"
                :class="{
                  'bg-bg-muted border-l-3 border-l-blue-500': selectedFile?.path === file.path,
                }"
                @click="selectedFile = file"
              >
                <!-- File icon -->
                <span :class="[getFileIcon(file.path), 'w-3.5 h-3.5 shrink-0']" />

                <!-- Change type indicator -->
                <span :class="[getChangeIcon(file.type), 'w-3 h-3 shrink-0']" />

                <!-- File path -->
                <span class="font-mono text-[10px] truncate min-w-0 group-hover:text-fg">
                  {{ file.path }}
                </span>
              </button>
            </nav>
          </div>
        </details>
      </aside>

      <!-- Right side: Diff viewer -->
      <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Diff viewer panel -->
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
              <span
                class="i-carbon-document-blank w-16 h-16 mx-auto text-fg-subtle/50 block mb-4"
              />
              <p class="text-fg-muted">Select a file from the sidebar to view its diff</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
