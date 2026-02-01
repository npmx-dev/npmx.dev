<script setup lang="ts">
import type {
  PackageFileTree,
  PackageFileTreeResponse,
  PackageFileContentResponse,
} from '#shared/types'
import { formatBytes } from '~/utils/formatters'

definePageMeta({
  name: 'code',
  alias: ['/package/code/:path(.*)*'],
})

const route = useRoute('code')

// Parse package name, version, and file path from URL
// Patterns:
//   /code/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0", filePath: null (show tree)
//   /code/nuxt/v/4.2.0/src/index.ts → packageName: "nuxt", version: "4.2.0", filePath: "src/index.ts"
//   /code/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0", filePath: null
const parsedRoute = computed(() => {
  const segments = route.params.path || []

  // Find the /v/ separator for version
  const vIndex = segments.indexOf('v')
  if (vIndex === -1 || vIndex >= segments.length - 1) {
    // No version specified - redirect or error
    return {
      packageName: segments.join('/'),
      version: null as string | null,
      filePath: null as string | null,
    }
  }

  const packageName = segments.slice(0, vIndex).join('/')
  const afterVersion = segments.slice(vIndex + 1)
  const version = afterVersion[0] ?? null
  const filePath = afterVersion.length > 1 ? afterVersion.slice(1).join('/') : null

  return { packageName, version, filePath }
})

const packageName = computed(() => parsedRoute.value.packageName)
const version = computed(() => parsedRoute.value.version)
const filePath = computed(() => parsedRoute.value.filePath)

// Fetch package data for version list
const { data: pkg } = usePackage(packageName)

// URL pattern for version selector - includes file path if present
const versionUrlPattern = computed(() => {
  const base = `/code/${packageName.value}/v/{version}`
  return filePath.value ? `${base}/${filePath.value}` : base
})

// Fetch file tree
const { data: fileTree, status: treeStatus } = useFetch<PackageFileTreeResponse>(
  () => `/api/registry/files/${packageName.value}/v/${version.value}`,
  {
    immediate: !!version.value,
  },
)

// Determine what to show based on the current path
// Note: This needs fileTree to be loaded first
const currentNode = computed(() => {
  if (!fileTree.value?.tree || !filePath.value) return null

  const parts = filePath.value.split('/')
  let current: PackageFileTree[] | undefined = fileTree.value.tree
  let lastFound: PackageFileTree | null = null

  for (const part of parts) {
    const found: PackageFileTree | undefined = current?.find(n => n.name === part)
    if (!found) return null
    lastFound = found
    if (found.type === 'file') return found
    current = found.children
  }

  return lastFound
})

const isViewingFile = computed(() => currentNode.value?.type === 'file')

// Maximum file size we'll try to load (500KB) - must match server
const MAX_FILE_SIZE = 500 * 1024
const isFileTooLarge = computed(() => {
  const size = currentNode.value?.size
  return size !== undefined && size > MAX_FILE_SIZE
})

// Fetch file content when a file is selected (and not too large)
const fileContentUrl = computed(() => {
  // Don't fetch if no file path, file tree not loaded, file is too large, or it's a directory
  if (!filePath.value || !fileTree.value || isFileTooLarge.value || !isViewingFile.value) {
    return null
  }
  return `/api/registry/file/${packageName.value}/v/${version.value}/${filePath.value}`
})

const {
  data: fileContent,
  status: fileStatus,
  execute: fetchFileContent,
} = useFetch<PackageFileContentResponse>(() => fileContentUrl.value!, { immediate: false })

watch(
  fileContentUrl,
  url => {
    if (url) fetchFileContent()
  },
  { immediate: true },
)

// Track hash manually since we update it via history API to avoid scroll
const currentHash = shallowRef('')

onMounted(() => {
  currentHash.value = window.location.hash
})

useEventListener('popstate', () => (currentHash.value = window.location.hash))

// Also sync when route changes (e.g., navigating to a different file)
watch(
  () => route.hash,
  hash => {
    currentHash.value = hash
  },
)

// Line number handling from hash
const selectedLines = computed(() => {
  const hash = currentHash.value
  if (!hash) return null

  // Parse #L10 or #L10-L20
  const match = hash.match(/^#L(\d+)(?:-L(\d+))?$/)
  if (!match) return null

  const start = parseInt(match[1] ?? '0', 10)
  const end = match[2] ? parseInt(match[2], 10) : start

  return { start, end }
})

// Scroll to selected line only on initial load or file change (not on click)
const shouldScrollOnHashChange = shallowRef(true)

function scrollToLine() {
  if (!shouldScrollOnHashChange.value) return
  if (!selectedLines.value) return
  const lineEl = document.getElementById(`L${selectedLines.value.start}`)
  if (lineEl) {
    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Scroll on file content load (initial or file change)
watch(fileContent, () => {
  shouldScrollOnHashChange.value = true
  nextTick(scrollToLine)
})

// Build breadcrumb path segments
const breadcrumbs = computed(() => {
  const parts = filePath.value?.split('/').filter(Boolean) ?? []
  const result: { name: string; path: string }[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part) {
      result.push({
        name: part,
        path: parts.slice(0, i + 1).join('/'),
      })
    }
  }

  return result
})

// Navigation helper - build URL for a path
function getCodeUrl(path?: string): string {
  const base = `/code/${packageName.value}/v/${version.value}`
  return path ? `${base}/${path}` : base
}

// Extract org name from scoped package
const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

// Build route object for package link (with optional version)
function packageRoute(ver?: string | null) {
  const segments = packageName.value.split('/')
  if (ver) {
    segments.push('v', ver)
  }
  return { name: 'package' as const, params: { package: segments } }
}

// Line number click handler - update URL hash without scrolling
function handleLineClick(lineNum: number, event: MouseEvent) {
  let newHash: string
  if (event.shiftKey && selectedLines.value) {
    // Shift+click: select range
    const start = Math.min(selectedLines.value.start, lineNum)
    const end = Math.max(selectedLines.value.end, lineNum)
    newHash = `#L${start}-L${end}`
  } else {
    // Single click: select line
    newHash = `#L${lineNum}`
  }

  // Don't scroll when user clicks - only scroll on initial load
  shouldScrollOnHashChange.value = false

  // Update URL without triggering scroll - use history API directly
  const url = new URL(window.location.href)
  url.hash = newHash
  window.history.replaceState(history.state, '', url.toString())

  // Update our reactive hash tracker
  currentHash.value = newHash
}

// Copy link to current line(s)
const { copied: permalinkCopied, copy: copyPermalink } = useClipboard({ copiedDuring: 2000 })
function copyPermalinkUrl() {
  const url = new URL(window.location.href)
  copyPermalink(url.toString())
}

// Canonical URL for this code page
const canonicalUrl = computed(() => {
  let url = `https://npmx.dev/code/${packageName.value}/v/${version.value}`
  if (filePath.value) {
    url += `/${filePath.value}`
  }
  return url
})

// Toggle markdown view mode
const markdownViewModes = [
  {
    key: 'preview',
    label: $t('code.markdown_view_mode.preview'),
    icon: 'i-carbon-view',
  },
  {
    key: 'code',
    label: $t('code.markdown_view_mode.code'),
    icon: 'i-carbon-code',
  },
] as const

const markdownViewMode = shallowRef<(typeof markdownViewModes)[number]['key']>('preview')

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: () => {
    if (filePath.value) {
      return `${filePath.value} - ${packageName.value}@${version.value} - npmx`
    }
    return `Code - ${packageName.value}@${version.value} - npmx`
  },
  description: () => `Browse source code for ${packageName.value}@${version.value}`,
})

defineOgImageComponent('Default', {
  title: () => `${pkg.value?.name ?? 'Package'} - Code`,
  description: () => pkg.value?.license ?? '',
  primaryColor: '#60a5fa',
})
</script>

<template>
  <main class="flex-1 flex flex-col">
    <!-- Header -->
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container py-4">
        <!-- Package info and navigation -->
        <div class="flex items-center gap-2 mb-3 flex-wrap min-w-0">
          <NuxtLink
            :to="packageRoute(version)"
            class="font-mono text-lg font-medium hover:text-fg transition-colors min-w-0 truncate max-w-[60vw] sm:max-w-none"
            :title="packageName"
          >
            <span v-if="orgName" class="text-fg-muted">@{{ orgName }}/</span
            >{{ orgName ? packageName.replace(`@${orgName}/`, '') : packageName }}
          </NuxtLink>
          <!-- Version selector -->
          <VersionSelector
            v-if="version && pkg?.versions && pkg?.['dist-tags']"
            :package-name="packageName"
            :current-version="version"
            :versions="pkg.versions"
            :dist-tags="pkg['dist-tags']"
            :url-pattern="versionUrlPattern"
          />
          <span
            v-else-if="version"
            class="px-2 py-0.5 font-mono text-sm bg-bg-muted border border-border rounded truncate max-w-32 sm:max-w-48"
            :title="`v${version}`"
          >
            v{{ version }}
          </span>
          <span class="text-fg-subtle shrink-0">/</span>
          <span class="font-mono text-sm text-fg-muted shrink-0">code</span>
        </div>

        <!-- Breadcrumb navigation -->
        <nav
          :aria-label="$t('code.file_path')"
          class="flex items-center gap-1 font-mono text-sm overflow-x-auto"
        >
          <NuxtLink
            v-if="filePath"
            :to="getCodeUrl()"
            class="text-fg-muted hover:text-fg transition-colors shrink-0"
          >
            {{ $t('code.root') }}
          </NuxtLink>
          <span v-else class="text-fg shrink-0">{{ $t('code.root') }}</span>
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
            <span class="text-fg-subtle">/</span>
            <NuxtLink
              v-if="i < breadcrumbs.length - 1"
              :to="getCodeUrl(crumb.path)"
              class="text-fg-muted hover:text-fg transition-colors"
            >
              {{ crumb.name }}
            </NuxtLink>
            <span v-else class="text-fg">{{ crumb.name }}</span>
          </template>
        </nav>
      </div>
    </header>

    <!-- Error: no version -->
    <div v-if="!version" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">{{ $t('code.version_required') }}</p>
      <NuxtLink :to="packageRoute()" class="btn">{{ $t('code.go_to_package') }}</NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-else-if="treeStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ $t('code.loading_tree') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="treeStatus === 'error'" class="container py-20 text-center" role="alert">
      <p class="text-fg-muted mb-4">{{ $t('code.failed_to_load_tree') }}</p>
      <NuxtLink :to="packageRoute(version)" class="btn">{{ $t('code.back_to_package') }}</NuxtLink>
    </div>

    <!-- Main content: file tree + file viewer -->
    <div v-else-if="fileTree" class="flex flex-1">
      <!-- File tree sidebar - sticky with internal scroll -->
      <aside
        class="w-64 lg:w-72 border-ie border-border shrink-0 hidden md:block bg-bg-subtle sticky top-28 self-start h-[calc(100vh-7rem)] overflow-y-auto"
      >
        <CodeFileTree
          :tree="fileTree.tree"
          :current-path="filePath ?? ''"
          :base-url="getCodeUrl()"
        />
      </aside>

      <!-- File content / Directory listing - sticky with internal scroll on desktop -->
      <div
        class="flex-1 min-w-0 md:sticky md:top-28 md:self-start md:h-[calc(100vh-7rem)] md:overflow-y-auto"
      >
        <!-- File viewer -->
        <template v-if="isViewingFile && fileContent">
          <div
            class="sticky z-10 top-0 bg-bg border-b border-border px-4 py-2 flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <div
                v-if="fileContent.markdownHtml"
                class="flex items-center gap-1 p-0.5 bg-bg-subtle border border-border-subtle rounded-md overflow-x-auto"
                role="tablist"
                aria-label="Markdown view mode selector"
              >
                <button
                  v-for="mode in markdownViewModes"
                  :key="mode.key"
                  role="tab"
                  class="px-2 py-1.5 font-mono text-xs rounded transition-colors duration-150 border border-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 inline-flex items-center gap-1.5"
                  :class="
                    markdownViewMode === mode.key
                      ? 'bg-bg shadow text-fg border-border'
                      : 'text-fg-subtle hover:text-fg border-transparent'
                  "
                  @click="markdownViewMode = mode.key"
                >
                  <span class="inline-block h-3 w-3" :class="mode.icon" aria-hidden="true" />
                  {{ mode.label }}
                </button>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="text-fg-muted">{{
                  $t('code.lines', { count: fileContent.lines })
                }}</span>
                <span v-if="currentNode?.size" class="text-fg-subtle">{{
                  formatBytes(currentNode.size)
                }}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="selectedLines"
                type="button"
                class="px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle border border-border rounded hover:text-fg hover:border-border-hover transition-colors active:scale-95"
                @click="copyPermalinkUrl"
              >
                {{ permalinkCopied ? $t('common.copied') : $t('code.copy_link') }}
              </button>
              <a
                :href="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
                target="_blank"
                rel="noopener noreferrer"
                class="px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle border border-border rounded hover:text-fg hover:border-border-hover transition-colors inline-flex items-center gap-1"
              >
                {{ $t('code.raw') }}
                <span class="i-carbon:launch w-3 h-3" />
              </a>
            </div>
          </div>
          <div
            v-if="fileContent.markdownHtml"
            v-show="markdownViewMode === 'preview'"
            class="flex justify-center p-4"
          >
            <Readme :html="fileContent.markdownHtml.html" />
          </div>

          <CodeViewer
            v-show="!fileContent.markdownHtml || markdownViewMode === 'code'"
            :html="fileContent.html"
            :lines="fileContent.lines"
            :selected-lines="selectedLines"
            @line-click="handleLineClick"
          />
        </template>

        <!-- File too large warning -->
        <div v-else-if="isViewingFile && isFileTooLarge" class="py-20 text-center">
          <div class="i-carbon:document w-12 h-12 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-2">{{ $t('code.file_too_large') }}</p>
          <p class="text-fg-subtle text-sm mb-4">
            {{ $t('code.file_size_warning', { size: formatBytes(currentNode?.size ?? 0) }) }}
          </p>
          <a
            :href="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
            target="_blank"
            rel="noopener noreferrer"
            class="btn inline-flex items-center gap-2"
          >
            {{ $t('code.view_raw') }}
            <span class="i-carbon:launch w-4 h-4" />
          </a>
        </div>

        <!-- Loading file content -->
        <div
          v-else-if="filePath && fileStatus === 'pending'"
          class="flex min-h-full"
          aria-busy="true"
          :aria-label="$t('common.loading')"
        >
          <!-- Fake line numbers column -->
          <div class="shrink-0 bg-bg-subtle border-ie border-border w-14 py-0">
            <div v-for="n in 20" :key="n" class="px-3 h-6 flex items-center justify-end">
              <span class="skeleton w-4 h-3 rounded-sm" />
            </div>
          </div>
          <!-- Fake code content -->
          <div class="flex-1 p-4 space-y-1.5">
            <div class="skeleton h-4 w-32 rounded-sm" />
            <div class="skeleton h-4 w-48 rounded-sm" />
            <div class="skeleton h-4 w-24 rounded-sm" />
            <div class="h-4" />
            <div class="skeleton h-4 w-64 rounded-sm" />
            <div class="skeleton h-4 w-56 rounded-sm" />
            <div class="skeleton h-4 w-40 rounded-sm" />
            <div class="skeleton h-4 w-72 rounded-sm" />
            <div class="h-4" />
            <div class="skeleton h-4 w-36 rounded-sm" />
            <div class="skeleton h-4 w-52 rounded-sm" />
            <div class="skeleton h-4 w-44 rounded-sm" />
            <div class="skeleton h-4 w-28 rounded-sm" />
            <div class="h-4" />
            <div class="skeleton h-4 w-60 rounded-sm" />
            <div class="skeleton h-4 w-48 rounded-sm" />
            <div class="skeleton h-4 w-32 rounded-sm" />
            <div class="skeleton h-4 w-56 rounded-sm" />
            <div class="skeleton h-4 w-40 rounded-sm" />
            <div class="skeleton h-4 w-24 rounded-sm" />
          </div>
        </div>

        <!-- Error loading file -->
        <div v-else-if="filePath && fileStatus === 'error'" class="py-20 text-center" role="alert">
          <div class="i-carbon:warning-alt w-8 h-8 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-2">{{ $t('code.failed_to_load') }}</p>
          <p class="text-fg-subtle text-sm mb-4">{{ $t('code.unavailable_hint') }}</p>
          <a
            :href="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
            target="_blank"
            rel="noopener noreferrer"
            class="btn inline-flex items-center gap-2"
          >
            {{ $t('code.view_raw') }}
            <span class="i-carbon:launch w-4 h-4" />
          </a>
        </div>

        <!-- Directory listing (when no file selected or viewing a directory) -->
        <template v-else>
          <CodeDirectoryListing
            :tree="fileTree.tree"
            :current-path="filePath ?? ''"
            :base-url="getCodeUrl()"
          />
        </template>
      </div>
    </div>

    <!-- Mobile file tree toggle -->
    <ClientOnly>
      <Teleport to="body">
        <CodeMobileTreeDrawer
          v-if="fileTree"
          :tree="fileTree.tree"
          :current-path="filePath ?? ''"
          :base-url="getCodeUrl()"
        />
      </Teleport>
    </ClientOnly>
  </main>
</template>
