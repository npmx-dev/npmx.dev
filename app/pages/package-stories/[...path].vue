<script setup lang="ts">
import type { StorybookFileTree } from '#shared/types'
import {
  transformStorybookEntries,
  findStoryById,
  getFirstStory,
  getFirstStoryInDirectory,
  getStoryBreadcrumbs,
} from '~/utils/storybook-tree'

definePageMeta({
  name: 'stories',
  path: '/package-stories/:path+',
  alias: ['/package/stories/:path+', '/stories/:path+'],
})

const route = useRoute('stories')

// Parse package name, version, and story ID from URL
// Patterns:
//   /stories/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0", storyId: null (auto-select first story)
//   /stories/nuxt/v/4.2.0?storyid=example-button--primary → packageName: "nuxt", version: "4.2.0", storyId: "example-button--primary"
//   /stories/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0", storyId: null
const parsedRoute = computed(() => {
  const segments = route.params.path
  const storyId = (route.query.storyid as string) || null

  // Find the /v/ separator for version
  const vIndex = segments.indexOf('v')
  if (vIndex === -1 || vIndex >= segments.length - 1) {
    // No version specified - redirect or error
    return {
      packageName: segments.join('/'),
      version: null as string | null,
      storyId,
    }
  }

  const packageName = segments.slice(0, vIndex).join('/')
  const afterVersion = segments.slice(vIndex + 1)
  const version = afterVersion[0] ?? null

  return { packageName, version, storyId }
})

const packageName = computed(() => parsedRoute.value.packageName)
const version = computed(() => parsedRoute.value.version)

// Fetch package data for version list
const { data: pkg } = usePackage(packageName)

// URL pattern for version selector - maintain current story if available
const versionUrlPattern = computed(() => {
  const base = `/package-stories/${packageName.value}/v/{version}`
  // Use placeholder for storyid that will be handled by version switch watcher
  return currentStoryId.value ? `${base}?storyid={storyid}` : base
})

// Fetch package.json to get Storybook URL
const { data: packageJson } = useFetch<{ storybook: { title: string; url: string } }>(() => {
  const url = `https://cdn.jsdelivr.net/npm/${packageName.value}/package.json`
  return url
})

// Fetch Storybook index data
const { data: storybookData, status: storybookStatus } = useLazyFetch<{
  v: number
  entries: Record<string, StorybookEntry>
}>(
  () => {
    if (!packageJson.value?.storybook?.url) return ''
    return packageJson.value.storybook.url + '/index.json'
  },
  {
    key: computed(() => `storybook:${packageName.value}`),
    server: false, // Storybook URLs are usually client-side only
  },
)

// Transform Storybook entries to tree structure
const storybookTree = computed(() => {
  if (!storybookData.value?.entries) return []
  return transformStorybookEntries(storybookData.value.entries)
})

// Find current story by ID
const currentStory = computed(() => {
  if (!storybookTree.value.length || !parsedRoute.value.storyId) return null
  return findStoryById(storybookTree.value, parsedRoute.value.storyId)
})

// Get current story ID for iframe
const currentStoryId = computed(() => {
  return parsedRoute.value.storyId || currentStory.value?.storyId || null
})

// Get first story for default selection
const firstStory = computed(() => {
  if (storybookTree.value.length) {
    return getFirstStory(storybookTree.value)
  }
  return null
})

// Auto-select first story if none specified
watch(
  [storybookTree, () => parsedRoute.value.storyId],
  ([tree, storyId]) => {
    if (tree.length && !storyId) {
      const first = getFirstStory(tree)
      if (first?.storyId) {
        navigateTo({
          name: 'stories',
          params: { path: [...packageName.value.split('/'), 'v', version.value!] },
          query: { storyid: first.storyId },
        })
      }
    }
  },
  { immediate: true },
)

// Watch for version changes and maintain current story if it exists
watch([() => version.value, storybookTree], ([newVersion, tree], [oldVersion]) => {
  if (
    newVersion &&
    oldVersion &&
    newVersion !== oldVersion &&
    tree.length &&
    currentStoryId.value
  ) {
    // Check if current story exists in new version
    const currentStoryInNewVersion = findStoryById(tree, currentStoryId.value!)

    if (currentStoryInNewVersion) {
      // Story exists, maintain it - URL will automatically include storyid
      return
    } else {
      // Story doesn't exist, try to find alternative
      if (currentStory.value) {
        const parts = currentStory.value.path.split('/')
        if (parts.length > 1) {
          // Try to find first story in same category
          const category = parts.slice(0, -1).join('/')
          const findStoryInCategory = (
            tree: StorybookFileTree[],
            category: string,
          ): StorybookFileTree | null => {
            for (const node of tree) {
              if (node.type === 'directory' && node.path === category) {
                return getFirstStoryInDirectory(node)
              }
              if (node.type === 'directory' && node.children) {
                const found = findStoryInCategory(node.children, category)
                if (found) return found
              }
            }
            return null
          }

          const firstStoryInCategory = findStoryInCategory(tree, category)
          if (firstStoryInCategory) {
            navigateTo({
              name: 'stories',
              params: { path: [...packageName.value.split('/'), 'v', newVersion] },
              query: { storyid: firstStoryInCategory.storyId },
            })
            return
          }
        }
      }

      // Fallback to first story overall
      const first = getFirstStory(tree)
      if (first?.storyId) {
        navigateTo({
          name: 'stories',
          params: { path: [...packageName.value.split('/'), 'v', newVersion] },
          query: { storyid: first.storyId },
        })
      }
    }
  }
})

// Build breadcrumbs for current story
const breadcrumbs = computed(() => {
  if (!currentStory.value) return []
  return getStoryBreadcrumbs(currentStory.value)
})

// Navigation helper - build URL for a story
function getStoryUrl(story: StorybookFileTree): string {
  const base = `/package-stories/${packageName.value}/v/${version.value}`
  return `${base}?storyid=${story.storyId}`
}

// Base path segments for route objects
const basePath = computed(() => {
  const segments = packageName.value.split('/')
  return [...segments, 'v', version.value ?? '']
})

// Extract org name from scoped package
const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

// Storybook iframe URL
const iframeUrl = computed(() => {
  if (!packageJson.value?.storybook?.url || !currentStoryId.value) return ''
  return `${packageJson.value.storybook.url}/iframe.html?id=${currentStoryId.value}`
})

// SEO Meta
useHead({
  title: () => {
    if (currentStory.value) {
      return `${currentStory.value.path} - ${packageName.value}@${version.value} - npmx`
    }
    return `Stories - ${packageName.value}@${version.value} - npmx`
  },
})

useSeoMeta({
  title: () => {
    if (currentStory.value) {
      return `${currentStory.value.path} - ${packageName.value}@${version.value} - npmx`
    }
    return `Stories - ${packageName.value}@${version.value} - npmx`
  },
  description: () => `Browse Storybook stories for ${packageName.value}@${version.value}`,
  ogDescription: () => `Browse Storybook stories for ${packageName.value}@${version.value}`,
})

defineOgImageComponent('Default', {
  title: () => `${pkg.value?.name ?? 'Package'} - Stories`,
  description: () => pkg.value?.license ?? '',
  primaryColor: '#ff6b6b',
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
            :to="packageRoute(packageName, version)"
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
          <span class="font-mono text-sm text-fg-muted shrink-0">Stories</span>
        </div>

        <!-- Breadcrumb navigation -->
        <nav
          :aria-label="$t('stories.story_path')"
          class="flex items-center gap-1 font-mono text-sm overflow-x-auto"
          dir="ltr"
        >
          <NuxtLink
            v-if="currentStory"
            :to="getStoryUrl(firstStory!)"
            class="text-fg-muted hover:text-fg transition-colors shrink-0"
          >
            {{ $t('stories.root') }}
          </NuxtLink>
          <span v-else class="text-fg shrink-0">{{ $t('stories.root') }}</span>
          <template v-for="(crumb, i) in breadcrumbs" :key="crumb.path">
            <span class="text-fg-subtle">/</span>
            <NuxtLink
              v-if="i < breadcrumbs.length - 1"
              :to="
                getStoryUrl({
                  path: crumb.path,
                  name: crumb.name,
                  storyId: crumb.storyId,
                  type: 'story',
                } as any)
              "
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
      <p class="text-fg-muted mb-4">{{ $t('stories.version_required') }}</p>
      <LinkBase variant="button-secondary" :to="packageRoute(packageName)">{{
        $t('stories.go_to_package')
      }}</LinkBase>
    </div>

    <!-- Loading state -->
    <div v-else-if="storybookStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ $t('stories.loading_stories') }}</p>
    </div>

    <!-- Error: no Storybook found -->
    <div v-else-if="!packageJson?.storybook?.url" class="container py-20 text-center">
      <div class="i-carbon:document-blank w-12 h-12 mx-auto text-fg-subtle mb-4" />
      <p class="text-fg-muted mb-4">{{ $t('stories.no_storybook_found') }}</p>
      <p class="text-fg-subtle text-sm mb-4">{{ $t('stories.check_package_json') }}</p>
      <LinkBase variant="button-secondary" :to="packageRoute(packageName, version)">{{
        $t('stories.back_to_package')
      }}</LinkBase>
    </div>

    <!-- Error loading Storybook data -->
    <div v-else-if="storybookStatus === 'error'" class="container py-20 text-center" role="alert">
      <div class="i-carbon:warning-alt w-8 h-8 mx-auto text-fg-subtle mb-4" />
      <p class="text-fg-muted mb-2">{{ $t('stories.failed_to_load_stories') }}</p>
      <p class="text-fg-subtle text-sm mb-4">{{ $t('stories.storybook_unavailable') }}</p>
      <a
        :href="packageJson.storybook.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-primary hover:text-primary-hover"
      >
        {{ $t('stories.open_storybook') }}
        <span class="i-carbon:launch w-3 h-3" />
      </a>
    </div>

    <!-- Main content: story tree + iframe viewer -->
    <div v-else-if="storybookTree.length" class="flex flex-1" dir="ltr">
      <!-- Story tree sidebar - sticky with internal scroll -->
      <aside
        class="w-64 lg:w-72 border-ie border-border shrink-0 hidden md:block bg-bg-subtle sticky top-28 self-start h-[calc(100vh-7rem)] overflow-y-auto"
      >
        <StorybookFileTree
          :tree="storybookTree"
          :current-story-id="currentStoryId"
          :base-url="`/package-stories/${packageName}/v/${version}`"
          :base-path="basePath"
        />
      </aside>

      <!-- Story iframe viewer -->
      <div class="flex-1 min-w-0">
        <div
          v-if="currentStory"
          class="sticky z-10 top-0 bg-bg border-b border-border px-4 py-2 flex items-center justify-between"
        >
          <div class="flex items-center gap-3 text-sm">
            <span class="text-fg-muted">{{ $t('stories.story') }}</span>
            <span class="text-fg font-medium">{{ currentStory.path }}</span>
            <span v-if="currentStory.story?.tags" class="text-fg-subtle">
              {{ currentStory.story.tags.join(', ') }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <a
              :href="packageJson.storybook.url"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle border border-border rounded hover:text-fg hover:border-border-hover transition-colors inline-flex items-center gap-1"
            >
              {{ $t('stories.open_in_storybook') }}
              <span class="i-carbon:launch w-3 h-3" />
            </a>
          </div>
        </div>

        <!-- Story iframe -->
        <div v-if="iframeUrl" class="w-full h-[calc(100vh-10rem)]">
          <iframe
            :src="iframeUrl"
            class="w-full h-full border-0"
            frameborder="0"
            :title="currentStory?.path || 'Storybook Story'"
          ></iframe>
        </div>

        <!-- No story selected -->
        <div v-else class="container py-20 text-center">
          <div class="i-carbon:document-blank w-12 h-12 mx-auto text-fg-subtle mb-4" />
          <p class="text-fg-muted mb-4">{{ $t('stories.select_story') }}</p>
        </div>
      </div>
    </div>

    <!-- Mobile story tree toggle -->
    <ClientOnly>
      <Teleport to="body">
        <StorybookMobileTreeDrawer
          v-if="storybookTree.length"
          :tree="storybookTree"
          :current-story-id="currentStoryId"
          :base-url="`/package-stories/${packageName}/v/${version}`"
          :base-path="basePath"
        />
      </Teleport>
    </ClientOnly>
  </main>
</template>
