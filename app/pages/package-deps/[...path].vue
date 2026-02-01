<script setup lang="ts">
import type { PackageDependenciesResponse } from '#shared/types'

definePageMeta({
  name: 'dependencies',
})

const route = useRoute('dependencies')

// Parse package name, version, and file path from URL
// Patterns:
//   /dependencies/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0"
//   /dependencies/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0"
const parsedRoute = computed(() => {
  const segments = route.params.path || []

  // Find the /v/ separator for version
  const vIndex = segments.indexOf('v')
  if (vIndex === -1 || vIndex >= segments.length - 1) {
    // No version specified - redirect or error
    return {
      packageName: segments.join('/'),
      version: null as string | null,
    }
  }

  const packageName = segments.slice(0, vIndex).join('/')
  const afterVersion = segments.slice(vIndex + 1)
  const version = afterVersion[0] ?? null

  return { packageName, version }
})

const packageName = computed(() => parsedRoute.value.packageName)
const version = computed(() => parsedRoute.value.version)

// Fetch package data for version list
const { data: pkg } = usePackage(packageName)

// URL pattern for version selector
const versionUrlPattern = computed(() => `/package-deps/${packageName.value}/v/{version}`)

// Fetch dependencies data
const { data: dependencies, status: dependenciesStatus } = useFetch<PackageDependenciesResponse>(
  () => `/api/registry/dependencies/${packageName.value}/v/${version.value}`,
  {
    immediate: !!version.value,
  },
)

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

// Group dependencies by depth
const directDependencies = computed(
  () => dependencies.value?.dependencies.filter(dep => dep.depth === 'direct') ?? [],
)

// Sort dev dependencies alphabetically
const devDependencies = computed(() => {
  if (!dependencies.value?.devDependencies) return []
  return Object.entries(dependencies.value.devDependencies).sort(([a], [b]) => a.localeCompare(b))
})

// SEO meta
const pageTitle = computed(() => {
  if (packageName.value && version.value) {
    return `Dependencies - ${packageName.value}@${version.value} - npmx`
  }
  return 'Dependencies - npmx'
})

const pageDescription = computed(() => {
  if (packageName.value && version.value) {
    return `Browse dependency tree for ${packageName.value}@${version.value}`
  }
  return 'Browse package dependencies'
})

const canonicalUrl = computed(() => {
  if (packageName.value && version.value) {
    return `https://npmx.dev/package-deps/${packageName.value}/v/${version.value}`
  }
  return 'https://npmx.dev/package-deps'
})

useHead({
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

useSeoMeta({
  title: pageTitle,
  description: pageDescription,
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
          <span class="font-mono text-sm text-fg-muted shrink-0">{{
            $t('dependencies.title')
          }}</span>
        </div>
      </div>
    </header>

    <!-- Error: no version -->
    <div v-if="!version" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">{{ $t('dependencies.version_required') }}</p>
      <NuxtLink :to="packageRoute()" class="btn">{{ $t('dependencies.go_to_package') }}</NuxtLink>
    </div>

    <!-- Loading state -->
    <div v-else-if="dependenciesStatus === 'pending'" class="container py-20 text-center">
      <div class="i-svg-spinners-ring-resize w-8 h-8 mx-auto text-fg-muted" />
      <p class="mt-4 text-fg-muted">{{ $t('dependencies.loading') }}</p>
    </div>

    <!-- Error state -->
    <div
      v-else-if="dependenciesStatus === 'error'"
      class="container py-20 text-center"
      role="alert"
    >
      <p class="text-fg-muted mb-4">{{ $t('dependencies.error') }}</p>
      <NuxtLink :to="packageRoute(version)" class="btn">{{
        $t('dependencies.back_to_package')
      }}</NuxtLink>
    </div>

    <!-- Main content -->
    <div v-else-if="dependencies" class="container py-6 w-full">
      <!-- Dependencies Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- Dependencies -->
        <section class="mb-8">
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('dependencies.title') }} ({{ dependencies.direct }})
          </h2>

          <div v-if="directDependencies.length === 0" class="text-fg-muted text-center py-8">
            {{ $t('dependencies.no_deps') }}
          </div>
          <ul v-else class="space-y-1 list-none m-0 p-0">
            <li
              v-for="dep in directDependencies"
              :key="`${dep.name}@${dep.version}`"
              class="flex items-center justify-between py-1 text-sm gap-2"
            >
              <div class="flex items-center gap-2 min-w-0">
                <NuxtLink
                  :to="`/${dep.name}`"
                  class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate"
                >
                  {{ dep.name }}
                </NuxtLink>
                <span
                  v-if="dep.optional"
                  class="px-1 py-0.5 font-mono text-[10px] text-fg-subtle bg-bg-muted border border-border rounded shrink-0"
                  :title="$t('dependencies.optional')"
                >
                  {{ $t('dependencies.optional') }}
                </span>
              </div>
              <span
                class="font-mono text-xs text-fg-subtle max-w-[50%] text-right truncate"
                :title="dep.version"
              >
                {{ dep.version }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Dev Dependencies -->
        <section v-if="devDependencies.length > 0">
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
            {{ $t('dependencies.dev_title') }} ({{ devDependencies.length }})
          </h2>

          <ul class="space-y-1 list-none m-0 p-0">
            <li
              v-for="[dep, version] in devDependencies"
              :key="`${dep}@${version}`"
              class="flex items-center justify-between py-1 text-sm gap-2"
            >
              <NuxtLink
                :to="`/${dep}`"
                class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
              >
                {{ dep }}
              </NuxtLink>
              <span
                class="font-mono text-xs text-fg-subtle max-w-[50%] text-right truncate"
                :title="version"
              >
                {{ version }}
              </span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </main>
</template>
