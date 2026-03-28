<script setup lang="ts">
// Maximum file size we'll try to load (500KB) - must match server
const MAX_FILE_SIZE = 500 * 1024

definePageMeta({
  name: 'code',
  path: '/package-code/:org?/:packageName/v/:version/:filePath(.*)?',
  alias: [
    '/package/code/:org?/:packageName/v/:version/:filePath(.*)?',
    '/package/code/:packageName/v/:version/:filePath(.*)?',
    // '/code/@:org?/:packageName/v/:version/:filePath(.*)?',
  ],
  scrollMargin: 160,
})

const route = useRoute('code')

const mobileFileTreeRef = useTemplateRef('mobileFileTreeRef')

const { codeContainerFull } = useCodeContainer()

// Parse package name, version, and file path from URL
// Patterns:
//   /code/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0", filePath: null (show tree)
//   /code/nuxt/v/4.2.0/src/index.ts → packageName: "nuxt", version: "4.2.0", filePath: "src/index.ts"
//   /code/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0", filePath: null
const parsedRoute = computed(() => {
  const packageName = route.params.org
    ? `${route.params.org}/${route.params.packageName}`
    : route.params.packageName
  const version = route.params.version
  const filePath = route.params.filePath || null

  return { packageName, version, filePath }
})

const packageName = computed(() => parsedRoute.value.packageName)
const version = computed(() => parsedRoute.value.version)
const filePathOrig = computed(() => parsedRoute.value.filePath)
const filePath = computed(() => parsedRoute.value.filePath?.replace(/\/$/, ''))

// Navigation helper - build URL for a path
function getCodeUrl(args: {
  org?: string
  packageName: string
  version: string
  filePath?: string
}): string {
  const base = args.org
    ? `/package-code/${args.org}/${args.packageName}/v/${args.version}`
    : `/package-code/${args.packageName}/v/${args.version}`
  return args.filePath ? `${base}/${args.filePath}` : base
}

// Fetch package data for version list
const { data: pkg } = usePackage(packageName)

// URL pattern for version selector - includes file path if present
const versionUrlPattern = computed(() =>
  getCodeUrl({
    org: route.params.org,
    packageName: route.params.packageName,
    version: '{version}',
    filePath: filePath.value,
  }),
)

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
  if (!fileTree.value?.tree || !filePathOrig.value) return null

  // We use original file path to correctly handle trailing slashes for file tree navigation
  // - /src/index.ts - correct file path
  // - /src/index.ts/ - incorrect file path (but formally can exist as a directory)
  // - /src/index and /src/index/ - correct directory paths
  const parts = filePathOrig.value.split('/')
  let current: PackageFileTree[] | undefined = fileTree.value.tree
  let lastFound: PackageFileTree | null = null
  const partsLength = parts.length

  for (let i = 0; i < partsLength; i++) {
    const part = parts[i]
    const isLast = i === partsLength - 1
    // If the previous part is a directory and the last one is empty (like /lib/) then return the previous directory
    if (!part && isLast && lastFound?.type === 'directory') return lastFound
    const found: PackageFileTree | undefined = current?.find(n => n.name === part)
    if (!found) return null
    lastFound = found
    if (found.type === 'file' && isLast) return found
    current = found.children
  }

  return lastFound
})

const isViewingFile = computed<boolean>(() => currentNode.value?.type === 'file')

// Estimate binary file based on mime type
const isBinaryFile = computed<boolean>(() => {
  if (!isViewingFile.value) return false

  const contentType = fileContent.value?.contentType
  if (!contentType) return false
  return isBinaryContentType(contentType)
})

const isFileTooLarge = computed<boolean>(() => {
  if (!isViewingFile.value) return false

  const size = currentNode.value?.size
  return size !== undefined && size > MAX_FILE_SIZE
})

// Fetch file content when a file is selected (and not too large)
const fileContentUrl = computed<string | null>(() => {
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

// Loading skeleton state
const isLoading = computed<boolean>(() => {
  if (!isViewingFile.value) {
    return treeStatus.value !== 'success' && treeStatus.value !== 'error'
  }

  return !fileStatus.value || fileStatus.value === 'pending' || fileStatus.value === 'idle'
})

function toggleMobileTreeDrawer(): void {
  mobileFileTreeRef.value?.toggle()
}

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

// Navigation helper - build URL for a path
function getCurrentCodeUrlWithPath(path?: string): string {
  return getCodeUrl({
    ...route.params,
    filePath: path,
  })
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

// Canonical URL for this code page
const canonicalUrl = computed(() => `https://npmx.dev${getCodeUrl(route.params)}`)

const markdownViewMode = shallowRef<'preview' | 'code'>('preview')

const bytesFormatter = useBytesFormatter()

// Keep latestVersion for comparison (to show "(latest)" badge)
const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

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
  ogTitle: () => {
    if (filePath.value) {
      return `${filePath.value} - ${packageName.value}@${version.value} - npmx`
    }
    return `Code - ${packageName.value}@${version.value} - npmx`
  },
  twitterTitle: () => {
    if (filePath.value) {
      return `${filePath.value} - ${packageName.value}@${version.value} - npmx`
    }
    return `Code - ${packageName.value}@${version.value} - npmx`
  },
  description: () => `Browse source code for ${packageName.value}@${version.value}`,
  ogDescription: () => `Browse source code for ${packageName.value}@${version.value}`,
  twitterDescription: () => `Browse source code for ${packageName.value}@${version.value}`,
})

defineOgImageComponent('Default', {
  title: () => `${pkg.value?.name ?? 'Package'} - Code`,
  description: () => pkg.value?.license ?? '',
  primaryColor: '#60a5fa',
})

onPrehydrate(() => {
  const settingsSaved = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
  const container = document.getElementById('code-page-container')

  if (settingsSaved?.codeContainerFull === true && container) {
    console.log('add max-w-full')
    container!.classList.add('max-w-full', 'border-0')
  }
})
</script>

<template>
  <main class="flex-1 flex flex-col">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="version"
      :display-version="pkg?.requestedVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="code"
    />

    <!-- Error: no version -->
    <div v-if="!version" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">{{ $t('code.version_required') }}</p>
      <LinkBase variant="button-secondary" :to="packageRoute(packageName)">{{
        $t('code.go_to_package')
      }}</LinkBase>
    </div>

    <!-- Loading state -->
    <div v-else-if="treeStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ $t('code.loading_tree') }}</p>
    </div>

    <!-- Error state -->
    <div v-else-if="treeStatus === 'error'" class="container py-20 text-center" role="alert">
      <p class="text-fg-muted mb-4">{{ $t('code.failed_to_load_tree') }}</p>
      <LinkBase variant="button-secondary" :to="packageRoute(packageName, version)">{{
        $t('code.back_to_package')
      }}</LinkBase>
    </div>

    <!-- Main content: file tree + file viewer -->
    <div
      v-else-if="!!fileTree"
      id="code-page-container"
      class="w-full grid grid-cols-[18rem_1fr] max-lg:grid-cols-[16rem_1fr] max-md:grid-cols-[1fr] border-border border-x px-0 mx-auto transition-[max-width] duration-300"
      :class="[codeContainerFull ? 'max-w-full border-0' : 'container']"
      dir="ltr"
    >
      <!-- File tree sidebar - sticky with internal scroll -->
      <aside
        class="sticky top-25 w-64 lg:w-72 hidden md:block h-[calc(100vh-10.5rem)] shrink-0 self-start bg-bg-subtle border-ie border-border"
      >
        <div class="h-[calc(100vh-10.5rem)] overflow-y-auto">
          <CodeFileTree
            :tree="fileTree.tree"
            :current-path="filePath ?? ''"
            :base-url="getCurrentCodeUrlWithPath()"
            :base-route="route"
          />
        </div>
      </aside>

      <!-- File content / Directory listing - sticky with internal scroll on desktop -->
      <div class="flex-1 grid grid-rows-[auto_1fr_auto] h-full min-h-full min-w-0 self-start">
        <CodeHeader
          :file-path="filePath"
          :loading="isLoading"
          :is-viewing-file="isViewingFile"
          :is-binary-file="isBinaryFile"
          :file-content="fileContent"
          v-model:markdown-view-mode="markdownViewMode"
          :selected-lines="selectedLines"
          :get-code-url-with-path="getCurrentCodeUrlWithPath"
          :package-name="packageName"
          :version="version"
          @mobile-tree-drawer-toggle="toggleMobileTreeDrawer()"
        />
        <!-- Loading file/directory content -->
        <CodeSkeletonLoader v-if="isLoading" />

        <!-- File viewer -->
        <template v-else-if="isViewingFile && !isBinaryFile && fileContent">
          <div
            v-if="fileContent.markdownHtml"
            v-show="markdownViewMode === 'preview'"
            class="flex min-h-full overflow-x-auto justify-center p-4"
          >
            <Readme :html="fileContent.markdownHtml.html" />
          </div>

          <CodeViewer
            v-show="!fileContent.markdownHtml || markdownViewMode === 'code'"
            :html="fileContent.html"
            :lines="fileContent.lines"
            :selected-lines="selectedLines"
            class="flex-1"
            @line-click="handleLineClick"
          />
          <!-- Bottom status bar -->
          <div class="sticky flex-auto bottom-0 bg-bg-subtle border-t border-border px-4 py-1">
            <div class="flex items-center h-5 font-mono gap-3 text-sm justify-end">
              <span class="text-fg-muted" dir="auto">{{
                $t('code.lines', { count: fileContent.lines })
              }}</span>
              <span v-if="currentNode?.size" class="text-fg-subtle">{{
                bytesFormatter.format(currentNode.size)
              }}</span>
            </div>
          </div>
        </template>

        <!-- Binary file warning -->
        <div v-else-if="isBinaryFile" class="py-20 text-center">
          <div class="i-lucide:binary w-12 h-12 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-2">{{ $t('code.binary_file') }}</p>
          <p class="text-fg-subtle text-sm mb-4">
            {{
              $t('code.binary_rendering_warning', {
                contentType: fileContent?.contentType ?? 'unknown',
              })
            }}
          </p>
          <LinkBase
            variant="button-secondary"
            :to="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
          >
            {{ $t('code.view_raw') }}
          </LinkBase>
        </div>

        <!-- File too large warning -->
        <div v-else-if="isFileTooLarge" class="py-20 text-center">
          <div class="i-lucide:file-text w-12 h-12 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-2">{{ $t('code.file_too_large') }}</p>
          <p class="text-fg-subtle text-sm mb-4">
            {{
              $t('code.file_size_warning', { size: bytesFormatter.format(currentNode?.size ?? 0) })
            }}
          </p>
          <LinkBase
            variant="button-secondary"
            :to="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
          >
            {{ $t('code.view_raw') }}
          </LinkBase>
        </div>

        <!-- Error loading file -->
        <div v-else-if="filePath && fileStatus === 'error'" class="py-20 text-center" role="alert">
          <div class="i-lucide:circle-alert w-8 h-8 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-2">{{ $t('code.failed_to_load') }}</p>
          <p class="text-fg-subtle text-sm mb-4">{{ $t('code.unavailable_hint') }}</p>
          <LinkBase
            variant="button-secondary"
            :to="`https://cdn.jsdelivr.net/npm/${packageName}@${version}/${filePath}`"
          >
            {{ $t('code.view_raw') }}
          </LinkBase>
        </div>

        <!-- Directory listing (when no file selected or viewing a directory) -->
        <template v-else>
          <CodeDirectoryListing
            :tree="fileTree.tree"
            :current-path="filePath ?? ''"
            :base-url="getCurrentCodeUrlWithPath()"
            :base-route="route"
          />
        </template>
      </div>
    </div>

    <!-- Mobile file tree toggle -->
    <ClientOnly>
      <Teleport to="body">
        <CodeMobileTreeDrawer
          v-if="fileTree"
          ref="mobileFileTreeRef"
          :tree="fileTree.tree"
          :current-path="filePath ?? ''"
          :base-url="getCurrentCodeUrlWithPath()"
          :base-route="route"
        />
      </Teleport>
    </ClientOnly>
  </main>
</template>
