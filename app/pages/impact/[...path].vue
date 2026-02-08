<script setup lang="ts">
import { assertValidPackageName } from '#shared/utils/npm'
import { packageRoute } from '~/utils/router'

definePageMeta({
  name: 'impact',
})

const route = useRoute('impact')
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

// Redirect to latest version if no version specified
watch(
  [requestedVersion, latestVersion, packageName],
  ([version, latest, name]) => {
    if (!version && latest && name) {
      router.replace(`/impact/${name}/v/${latest}`)
    }
  },
  { immediate: true },
)

const resolvedVersion = computed(() => requestedVersion.value ?? latestVersion.value)

// Package specifier for the bundler (e.g., "react@18.2.0")
const packageSpec = computed(() => {
  if (!packageName.value || !resolvedVersion.value) return null
  return `${packageName.value}@${resolvedVersion.value}`
})

// Extract org name from scoped package
const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

const pageTitle = computed(() => {
  if (!packageName.value) return 'Bundle Impact - npmx'
  if (!resolvedVersion.value) return `${packageName.value} impact - npmx`
  return `${packageName.value}@${resolvedVersion.value} impact - npmx`
})

useSeoMeta({
  title: () => pageTitle.value,
  description: () =>
    packageName.value
      ? `Analyze bundle size impact of ${packageName.value}`
      : 'Analyze npm package bundle size impact',
})
</script>

<template>
  <div class="impact-page flex-1 flex flex-col">
    <!-- Visually hidden h1 for accessibility -->
    <h1 class="sr-only">{{ packageName }} Bundle Impact</h1>

    <!-- Sticky header -->
    <header
      aria-label="Package impact header"
      class="impact-header sticky z-10 bg-bg/95 backdrop-blur border-b border-border"
    >
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <NuxtLink
              v-if="packageName"
              :to="packageRoute(packageName)"
              class="font-mono text-lg sm:text-xl font-semibold text-fg hover:text-fg-muted transition-colors truncate"
            >
              <span v-if="orgName" class="text-fg-muted">@{{ orgName }}/</span
              >{{ orgName ? packageName.replace(`@${orgName}/`, '') : packageName }}
            </NuxtLink>
            <VersionSelector
              v-if="resolvedVersion && pkg?.versions && pkg?.['dist-tags']"
              :package-name="packageName"
              :current-version="resolvedVersion"
              :versions="pkg.versions"
              :dist-tags="pkg['dist-tags']"
              :url-pattern="`/impact/${packageName}/v/{version}`"
            />
            <span v-else-if="resolvedVersion" class="text-fg-subtle font-mono text-sm shrink-0">
              {{ resolvedVersion }}
            </span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20"
            >
              {{ $t('impact.title') }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- Error: no version -->
    <div v-if="!resolvedVersion" class="container py-20 text-center">
      <p class="text-fg-muted mb-4">{{ $t('impact.version_required') }}</p>
      <NuxtLink :to="packageRoute(packageName)" class="btn">{{
        $t('impact.go_to_package')
      }}</NuxtLink>
    </div>

    <!-- Main content - client only since it uses Web Workers -->
    <ClientOnly v-else>
      <ImpactAnalyzer :package-spec="packageSpec!" :package-name="packageName" />
      <template #fallback>
        <div class="container py-20 text-center">
          <div class="i-svg-spinners:ring-resize w-8 h-8 mx-auto text-fg-muted" />
          <p class="mt-4 text-fg-muted">{{ $t('common.loading') }}</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<style>
/* Layout constants - must match AppHeader height */
.impact-page {
  --app-header-height: 57px;
  --impact-header-height: 57px;
  --combined-header-height: calc(var(--app-header-height) + var(--impact-header-height));
}

.impact-header {
  top: var(--app-header-height);
}
</style>
