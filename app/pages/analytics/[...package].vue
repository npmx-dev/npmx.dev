<script setup lang="ts">
definePageMeta({
  name: 'analytics',
})

const route = useRoute('analytics')
const router = useRouter()

// Extract package name from route params (handles scoped packages like @org/pkg)
const packageName = computed(() => {
  const params = route.params.package || []
  return params.join('/')
})

// Fetch package data to get creation date and check if package exists
const { data: packument, status: packageStatus } = usePackage(packageName)
const createdIso = computed(() => packument.value?.time?.created ?? null)

// Determine if package exists (has data after loading)
const packageExists = computed(() => packageStatus.value === 'success' && !!packument.value)

// Close destination: package page if exists, home otherwise
const closeDestination = computed(() => (packageExists.value ? `/${packageName.value}` : '/'))

// Fetch weekly downloads for initial display
const { fetchPackageDownloadEvolution } = useCharts()
const weeklyDownloads = shallowRef<WeeklyDownloadPoint[]>([])

async function loadWeeklyDownloads() {
  if (!import.meta.client) return
  if (!packageName.value) return

  try {
    const result = await fetchPackageDownloadEvolution(
      () => packageName.value,
      () => createdIso.value,
      () => ({ granularity: 'week' as const, weeks: 52 }),
    )
    weeklyDownloads.value = (result as WeeklyDownloadPoint[]) ?? []
  } catch {
    weeklyDownloads.value = []
  }
}

onMounted(() => {
  loadWeeklyDownloads()
})

watch(packageName, () => loadWeeklyDownloads())

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    router.push(closeDestination.value)
  }
}

// SEO
useSeoMeta({
  title: () => (packageName.value ? `${packageName.value} Downloads - npmx` : 'Downloads - npmx'),
  description: () => `Download statistics and trends for ${packageName.value}`,
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
      @keydown="handleKeydown"
    >
      <!-- Backdrop - clicking navigates back -->
      <NuxtLink
        :to="closeDestination"
        class="absolute inset-0 bg-black/60 cursor-default"
        :aria-label="$t('common.close_modal')"
      />

      <div
        class="relative w-full h-full sm:h-auto bg-bg sm:border sm:border-border sm:rounded-lg shadow-xl sm:max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analytics-modal-title"
      >
        <div class="p-4 sm:p-6">
          <div class="flex items-center justify-between mb-4 sm:mb-6">
            <h1 id="analytics-modal-title" class="font-mono text-lg font-medium">
              {{ $t('package.downloads.modal_title') }}
            </h1>
            <NuxtLink
              :to="closeDestination"
              class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
              :aria-label="$t('common.close')"
            >
              <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </div>
          <div class="font-mono text-sm">
            <ClientOnly>
              <PackageDownloadAnalytics
                :weeklyDownloads="weeklyDownloads"
                :inModal="true"
                :packageName="packageName"
                :createdIso="createdIso"
              />
              <template #fallback>
                <div class="min-h-[260px] flex items-center justify-center">
                  <span
                    class="i-carbon:circle-dash w-6 h-6 motion-safe:animate-spin text-fg-subtle"
                  />
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>

        <!-- Mobile close button -->
        <div class="sm:hidden flex justify-center pb-4">
          <NuxtLink
            :to="closeDestination"
            class="w-12 h-12 bg-bg-elevated border border-border rounded-full shadow-lg flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
            :aria-label="$t('common.close')"
          >
            <span class="w-5 h-5 i-carbon:close" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </Teleport>
</template>
