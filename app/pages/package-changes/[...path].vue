<script setup lang="ts">
definePageMeta({
  name: 'changes',
  path: '/package-changes/:path+',
  alias: ['/package/changes/:path+', '/changes/:path+'],
})

/// routing

const route = useRoute('changes')
const router = useRouter()
// Parse package name, version, and file path from URL
// Patterns:
//   /code/nuxt/v/4.2.0 → packageName: "nuxt", version: "4.2.0", filePath: null (show tree)
//   /code/nuxt/v/4.2.0/src/index.ts → packageName: "nuxt", version: "4.2.0", filePath: "src/index.ts"
//   /code/@nuxt/kit/v/1.0.0 → packageName: "@nuxt/kit", version: "1.0.0", filePath: null
const parsedRoute = computed(() => {
  const segments = route.params.path

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
// const filePathOrig = computed(() => parsedRoute.value.filePath)
const filePath = computed(() => parsedRoute.value.filePath?.replace(/\/$/, ''))

const { data: pkg } = usePackage(packageName)

const versionUrlPattern = computed(() => {
  const base = `/package-changes/${packageName.value}/v/{version}`
  return filePath.value ? `${base}/${filePath.value}` : base
})

const latestVersion = computed(() => pkg.value?.['dist-tags']?.latest ?? null)

watch(
  [version, latestVersion, packageName],
  ([version, latest, name]) => {
    if (!version && latest && name) {
      const pathSegments = [...name.split('/'), 'v', latest]
      router.replace({ name: 'changes', params: { path: pathSegments as [string, ...string[]] } })
    }
  },
  { immediate: true },
)

// getting info

const { data: changelog, pending } = usePackageChangelog(packageName, version)
</script>
<template>
  <main class="flex-1 flex flex-col">
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container pt-4 pb-3">
        <div class="flex items-center gap-2 mb-3 flex-wrap min-w-0">
          <h1
            class="font-mono text-lg sm:text-xl font-semibold text-fg hover:text-fg-muted transition-colors truncate"
          >
            <NuxtLink v-if="packageName" :to="packageRoute(packageName, version)">
              {{ packageName }}
            </NuxtLink>
          </h1>

          <VersionSelector
            v-if="version && pkg?.versions && pkg?.['dist-tags']"
            :package-name="packageName"
            :current-version="version"
            :versions="pkg.versions"
            :dist-tags="pkg['dist-tags']"
            :url-pattern="versionUrlPattern"
          />
        </div>
      </div>
    </header>

    <section class="container w-full" v-if="changelog">
      <LazyChangelogReleases v-if="changelog.type == 'release'" :info="changelog" />
      <LazyChangelogMarkdown
        v-else-if="changelog.type == 'md'"
        :info="changelog"
      ></LazyChangelogMarkdown>
      <p v-else-if="!pending">Sorry, this package doesn't track any changelogs</p>
    </section>
  </main>
</template>
