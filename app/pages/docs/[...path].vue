<script setup lang="ts">
import type { DocsResponse } from '#shared/types'
import { assertValidPackageName } from '#shared/utils/npm'

definePageMeta({
  name: 'docs',
})

const route = useRoute('docs')
const router = useRouter()

const parsedRoute = computed(() => {
  const segments = route.params.path || []
  const vIndex = segments.indexOf('v')

  if (vIndex === -1 || vIndex >= segments.length - 1) {
    return {
      packageName: segments.join('/'),
      version: null as string | null,
    }
  }

  return {
    packageName: segments.slice(0, vIndex).join('/'),
    version: segments.slice(vIndex + 1).join('/'),
  }
})

const packageName = computed(() => parsedRoute.value.packageName)
const requestedVersion = computed(() => parsedRoute.value.version)

// Validate package name on server-side for early error detection
if (import.meta.server && packageName.value) {
  assertValidPackageName(packageName.value)
}

const { data: pkg } = usePackage(packageName)

const latestVersion = computed(() => pkg.value?.['dist-tags']?.latest ?? null)

watch(
  [requestedVersion, latestVersion, packageName],
  ([version, latest, name]) => {
    if (!version && latest && name) {
      router.replace(`/docs/${name}/v/${latest}`)
    }
  },
  { immediate: true },
)

const resolvedVersion = computed(() => requestedVersion.value ?? latestVersion.value)

const docsUrl = computed(() => {
  if (!packageName.value || !resolvedVersion.value) return null
  return `/api/registry/docs/${packageName.value}/v/${resolvedVersion.value}`
})

const shouldFetch = computed(() => !!docsUrl.value)

const { data: docsData, status: docsStatus } = useLazyFetch<DocsResponse>(
  () => docsUrl.value ?? '',
  {
    watch: [docsUrl],
    immediate: shouldFetch.value,
    default: () => ({
      package: packageName.value,
      version: resolvedVersion.value ?? '',
      html: '',
      toc: null,
      status: 'missing' as const,
      message: 'Docs are not available for this version.',
    }),
  },
)

const pageTitle = computed(() => {
  if (!packageName.value) return 'API Docs - npmx'
  if (!resolvedVersion.value) return `${packageName.value} docs - npmx`
  return `${packageName.value}@${resolvedVersion.value} docs - npmx`
})

useSeoMeta({
  title: () => pageTitle.value,
})

const showLoading = computed(() => docsStatus.value === 'pending')
const showEmptyState = computed(() => docsData.value?.status !== 'ok')
</script>

<template>
  <div class="docs-page min-h-screen">
    <!-- Visually hidden h1 for accessibility -->
    <h1 class="sr-only">{{ packageName }} API Documentation</h1>

    <!-- Sticky header - positioned below AppHeader -->
    <header
      aria-label="Package documentation header"
      class="docs-header sticky z-10 bg-bg/95 backdrop-blur border-b border-border"
    >
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <NuxtLink
              v-if="packageName"
              :to="`/${packageName}`"
              class="font-mono text-lg sm:text-xl font-semibold text-fg hover:text-fg-muted transition-colors truncate"
            >
              {{ packageName }}
            </NuxtLink>
            <VersionSelector
              v-if="resolvedVersion && pkg?.versions && pkg?.['dist-tags']"
              :package-name="packageName"
              :current-version="resolvedVersion"
              :versions="pkg.versions"
              :dist-tags="pkg['dist-tags']"
              :url-pattern="`/docs/${packageName}/v/{version}`"
            />
            <span v-else-if="resolvedVersion" class="text-fg-subtle font-mono text-sm shrink-0">
              {{ resolvedVersion }}
            </span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
            >
              API Docs
            </span>
          </div>
        </div>
      </div>
    </header>

    <div class="flex">
      <!-- Sidebar TOC -->
      <aside
        v-if="docsData?.toc && !showEmptyState"
        class="hidden lg:block w-64 xl:w-72 shrink-0 border-r border-border"
      >
        <div class="docs-sidebar sticky overflow-y-auto p-4">
          <h2 class="text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-4">
            Contents
          </h2>
          <!-- eslint-disable vue/no-v-html -->
          <div class="toc-content" v-html="docsData.toc" />
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0">
        <div v-if="showLoading" class="p-6 sm:p-8 lg:p-12 space-y-4">
          <div class="skeleton h-8 w-64 rounded" />
          <div class="skeleton h-4 w-full max-w-2xl rounded" />
          <div class="skeleton h-4 w-5/6 max-w-2xl rounded" />
          <div class="skeleton h-4 w-3/4 max-w-2xl rounded" />
        </div>

        <div v-else-if="showEmptyState" class="p-6 sm:p-8 lg:p-12">
          <div class="max-w-xl rounded-lg border border-border bg-bg-muted p-6">
            <h2 class="font-mono text-lg mb-2">Docs not available</h2>
            <p class="text-fg-subtle text-sm">
              {{ docsData?.message ?? 'We could not generate docs for this version.' }}
            </p>
            <div class="flex gap-4 mt-4">
              <NuxtLink
                v-if="packageName"
                :to="`/${packageName}`"
                class="link-subtle font-mono text-sm"
              >
                View package
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- eslint-disable vue/no-v-html -->
        <div v-else class="docs-content p-6 sm:p-8 lg:p-12" v-html="docsData?.html" />
      </main>
    </div>
  </div>
</template>

<style>
/* Layout constants - must match AppHeader height */
.docs-page {
  --app-header-height: 57px;
  --docs-header-height: 57px;
  --combined-header-height: calc(var(--app-header-height) + var(--docs-header-height));
}

.docs-header {
  top: var(--app-header-height);
}

.docs-sidebar {
  top: var(--combined-header-height);
  height: calc(100vh - var(--combined-header-height));
}

/* Table of contents styles */
.toc-content ul {
  @apply space-y-1;
}

.toc-content > ul > li {
  @apply mb-4;
}

.toc-content > ul > li > a {
  @apply text-sm font-medium text-fg-muted hover:text-fg;
}

.toc-content > ul > li > ul {
  @apply mt-2 pl-3 border-l border-border/50;
}

.toc-content > ul > li > ul a {
  @apply text-xs text-fg-subtle hover:text-fg block py-0.5 truncate;
}

/* Main docs content container - no max-width to use full space */
.docs-content {
  @apply max-w-none;
}

/* Section headings */
.docs-content .docs-section {
  @apply mb-16;
}

.docs-content .docs-section-title {
  @apply text-lg font-semibold text-fg mb-8 pb-3 pt-4 border-b border-border sticky bg-bg z-[2];
  top: var(--combined-header-height);
}

/* Individual symbol articles */
.docs-content .docs-symbol {
  @apply mb-10 pb-10 border-b border-border/30 last:border-0;
}

.docs-content .docs-symbol:target {
  @apply scroll-mt-32;
}

.docs-content .docs-symbol:target .docs-symbol-header {
  @apply bg-amber-500/10 -mx-3 px-3 py-1 rounded-md;
}

/* Symbol header (name + badges) */
.docs-content .docs-symbol-header {
  @apply flex items-center gap-3 mb-4 flex-wrap;
}

.docs-content .docs-anchor {
  @apply text-fg-subtle/50 hover:text-fg-subtle transition-colors text-lg no-underline;
}

.docs-content .docs-symbol-name {
  @apply font-mono text-lg font-semibold text-fg m-0;
}

/* Badges */
.docs-content .docs-badge {
  @apply text-xs px-2 py-0.5 rounded-full font-medium;
}

.docs-content .docs-badge--function {
  @apply bg-blue-500/15 text-blue-400;
}
.docs-content .docs-badge--class {
  @apply bg-amber-500/15 text-amber-400;
}
.docs-content .docs-badge--interface {
  @apply bg-emerald-500/15 text-emerald-400;
}
.docs-content .docs-badge--typeAlias {
  @apply bg-violet-500/15 text-violet-400;
}
.docs-content .docs-badge--variable {
  @apply bg-orange-500/15 text-orange-400;
}
.docs-content .docs-badge--enum {
  @apply bg-pink-500/15 text-pink-400;
}
.docs-content .docs-badge--namespace {
  @apply bg-cyan-500/15 text-cyan-400;
}
.docs-content .docs-badge--async {
  @apply bg-purple-500/15 text-purple-400;
}

/* Signature code block - now uses Shiki */
.docs-content .docs-signature {
  @apply mb-5;
}

.docs-content .docs-signature .shiki {
  @apply text-sm bg-bg-muted/50 border border-border/50 p-4 rounded-lg;
  white-space: pre-wrap;
  word-break: break-word;
}

.docs-content .docs-signature .shiki code {
  @apply text-sm;
  white-space: pre-wrap;
}

/* Overload count badge */
.docs-content .docs-overload-count {
  @apply text-xs text-fg-subtle;
}

/* More overloads indicator */
.docs-content .docs-more-overloads {
  @apply text-xs text-fg-subtle italic mt-2 mb-0;
}

/* Description text */
.docs-content .docs-description {
  @apply text-sm text-fg-muted leading-relaxed mb-5;
}

/* Inline code in descriptions */
.docs-content .docs-description code {
  @apply bg-bg-muted px-1.5 py-0.5 rounded text-xs font-mono;
}

/*
 * Fenced code blocks in descriptions use a subtle left-border style.
 *
 * Design rationale: We use two visual styles for code examples:
 * 1. Boxed style (bg + border + padding) - for formal @example JSDoc tags
 *    and function signatures. These are intentional, structured sections.
 * 2. Left-border style (blockquote-like) - for inline code in descriptions.
 *    These are illustrative/casual and shouldn't compete with the signature.
 */
.docs-content .docs-description .shiki {
  @apply text-sm pl-4 py-3 my-4 border-l-2 border-border;
  white-space: pre-wrap;
  word-break: break-word;
}

.docs-content .docs-description .shiki code {
  @apply text-sm bg-transparent p-0;
  white-space: pre-wrap;
}

/* Deprecation warning */
.docs-content .docs-deprecated {
  @apply bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-5;
}

.docs-content .docs-deprecated strong {
  @apply text-amber-400 text-sm;
}

.docs-content .docs-deprecated p {
  @apply text-amber-300/80 text-sm mt-2 mb-0;
}

/* Parameters, Returns, Examples, See Also sections */
.docs-content .docs-params,
.docs-content .docs-returns,
.docs-content .docs-examples,
.docs-content .docs-see,
.docs-content .docs-members {
  @apply mb-5;
}

.docs-content .docs-params h4,
.docs-content .docs-returns h4,
.docs-content .docs-examples h4,
.docs-content .docs-see h4,
.docs-content .docs-members h4 {
  @apply text-xs font-semibold text-fg-subtle uppercase tracking-wider mb-3;
}

/* Definition lists for params/members */
.docs-content dl {
  @apply space-y-2;
}

.docs-content dt {
  @apply font-mono text-sm text-fg-muted;
}

.docs-content dd {
  @apply text-sm text-fg-subtle ml-4 mb-3;
}

/* Returns paragraph */
.docs-content .docs-returns p {
  @apply text-sm text-fg-muted m-0;
}

/* Example code blocks from @example JSDoc tags - boxed style (see design rationale above) */
.docs-content .docs-examples .shiki {
  @apply text-sm bg-bg-muted border border-border/50 p-4 rounded-lg overflow-x-auto mb-3;
}

.docs-content .docs-examples .shiki code {
  @apply text-sm;
}

/* See also list */
.docs-content .docs-see ul {
  @apply list-disc list-inside text-sm text-fg-muted space-y-1;
}

.docs-content .docs-link {
  @apply text-blue-400 hover:text-blue-300 underline underline-offset-2;
}

/* Symbol cross-reference links */
.docs-content .docs-symbol-link {
  @apply text-emerald-400 hover:text-emerald-300 underline underline-offset-2;
}

/* Unknown symbol references shown as code */
.docs-content .docs-symbol-ref {
  @apply bg-bg-muted px-1.5 py-0.5 rounded text-xs font-mono;
}

/* Inline code in descriptions */
.docs-content .docs-inline-code {
  @apply bg-bg-muted px-1.5 py-0.5 rounded text-xs font-mono;
}

/* Enum members */
.docs-content .docs-enum-members {
  @apply flex flex-wrap gap-2 list-none p-0;
}

.docs-content .docs-enum-members li {
  @apply m-0;
}

.docs-content .docs-enum-members code {
  @apply text-sm font-mono text-fg-muted bg-bg-muted px-2 py-1 rounded;
}

/* Members section (constructors, properties, methods) */
.docs-content .docs-members pre {
  @apply text-sm bg-bg-muted/50 border border-border/50 p-3 rounded-lg overflow-x-auto font-mono;
}

.docs-content .docs-members pre code {
  @apply text-fg-muted;
}
</style>
