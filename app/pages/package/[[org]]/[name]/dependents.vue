<script setup lang="ts">
definePageMeta({
  name: 'package-dependents',
  scrollMargin: 200,
})

const route = useRoute('package-dependents')

const packageName = computed(() => {
  const { org, name } = route.params
  return org ? `${org}/${name}` : name
})

const { data: pkg } = usePackage(packageName)

const resolvedVersion = computed(() => {
  const latest = pkg.value?.['dist-tags']?.latest
  if (!latest) return null
  return latest
})

const displayVersion = computed(() => pkg.value?.requestedVersion ?? null)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const versionUrlPattern = computed(() => {
  const split = packageName.value.split('/')
  if (split.length === 2) {
    return `/package/${split[0]}/${split[1]}/v/{version}`
  }
  return `/package/${packageName.value}/v/{version}`
})

const page = shallowRef(0)
const PAGE_SIZE = 20

interface DependentsResponse {
  total: number
  page: number
  size: number
  packages: Array<{
    name: string
    version: string
    description: string | null
    date: string | null
    score: number
  }>
}

const { data, status, refresh } = useLazyFetch<DependentsResponse>(
  () => `/api/registry/dependents/${packageName.value}`,
  {
    query: computed(() => ({ page: page.value, size: PAGE_SIZE })),
    watch: [page],
  },
)

const totalPages = computed(() => {
  if (!data.value?.total) return 0
  return Math.ceil(data.value.total / PAGE_SIZE)
})

function prevPage() {
  if (page.value > 0) {
    page.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function nextPage() {
  if (page.value < totalPages.value - 1) {
    page.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const numberFormatter = useNumberFormatter()

useSeoMeta({
  title: () => `Dependents - ${packageName.value} - npmx`,
  description: () => `Packages that depend on ${packageName.value}`,
})
</script>

<template>
  <main class="flex-1 pb-8">
    <PackageHeader
      :pkg="pkg ?? null"
      :resolved-version="resolvedVersion"
      :display-version="displayVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="dependents"
    />

    <div class="container py-6">
      <h1 class="font-mono text-xl font-semibold mb-1">
        {{ $t('package.dependents.title') }}
      </h1>
      <p class="text-sm text-fg-muted mb-6">
        {{ $t('package.dependents.subtitle', { name: packageName }) }}
      </p>

      <!-- Loading state -->
      <div v-if="status === 'pending'" class="space-y-2">
        <SkeletonInline v-for="i in 10" :key="i" class="h-16 w-full rounded-md" />
      </div>

      <!-- Error state -->
      <div v-else-if="status === 'error'" class="py-12 text-center">
        <p class="text-fg-muted mb-4">{{ $t('package.dependents.error') }}</p>
        <ButtonBase @click="refresh()">{{ $t('common.retry') }}</ButtonBase>
      </div>

      <!-- Empty state -->
      <div v-else-if="!data?.packages?.length" class="py-12 text-center">
        <span class="i-lucide:package-x w-12 h-12 mx-auto mb-4 text-fg-subtle block" />
        <p class="text-fg-muted">{{ $t('package.dependents.none', { name: packageName }) }}</p>
      </div>

      <!-- Results -->
      <template v-else>
        <p class="text-xs text-fg-subtle mb-4 font-mono">
          {{
            $t(
              'package.dependents.count',
              { count: numberFormatter.format(data.total) },
              data.total,
            )
          }}
        </p>

        <ul class="space-y-2 list-none m-0 p-0">
          <li
            v-for="dep in data.packages"
            :key="dep.name"
            class="border border-border rounded-md p-4 hover:border-border-hover transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <LinkBase
                  :to="packageRoute(dep.name)"
                  class="font-mono text-sm font-medium"
                  dir="ltr"
                >
                  {{ dep.name }}
                </LinkBase>
                <p v-if="dep.description" class="text-xs text-fg-muted mt-1 line-clamp-2">
                  {{ dep.description }}
                </p>
              </div>
              <span class="font-mono text-xs text-fg-subtle shrink-0" dir="ltr">
                {{ dep.version }}
              </span>
            </div>
          </li>
        </ul>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-6">
          <ButtonBase
            variant="secondary"
            classicon="i-lucide:chevron-left"
            :disabled="page === 0"
            @click="prevPage"
          >
            {{ $t('common.previous') }}
          </ButtonBase>
          <span class="text-sm text-fg-muted font-mono">
            {{ page + 1 }} / {{ totalPages }}
          </span>
          <ButtonBase
            variant="secondary"
            :disabled="page >= totalPages - 1"
            @click="nextPage"
          >
            {{ $t('common.next') }}
            <span class="i-lucide:chevron-right w-4 h-4" aria-hidden="true" />
          </ButtonBase>
        </div>
      </template>
    </div>
  </main>
</template>
