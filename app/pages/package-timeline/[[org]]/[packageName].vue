<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { compare } from 'semver'
import type {
  TimelineResponse,
  TimelineVersion,
} from '~~/server/api/registry/timeline/[...pkg].get'
import type { TimelineSizeResponse } from '~~/server/api/registry/timeline/sizes/[...pkg].get'

definePageMeta({
  name: 'timeline',
  path: '/package-timeline/:org?/:packageName/v/:version',
})

const { t } = useI18n()

const route = useRoute('timeline')

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)
const version = computed(() => route.params.version)

const { data: pkg } = usePackage(packageName, version)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const versionUrlPattern = computed(() => {
  const { org, packageName: name } = route.params
  return `/package-timeline/${org ? `${org}/` : ''}${name}/v/{version}`
})

function packageRoute(ver: string): RouteLocationRaw {
  return {
    name: 'package-version',
    params: { org: route.params.org, name: route.params.packageName, version: ver },
  }
}

// Paginated timeline data from server
const PAGE_SIZE = 25

const timelineEntries = ref<TimelineVersion[]>([])
const totalVersions = ref(0)
const loadingMore = ref(false)
const loadError = ref(false)

const hasMore = computed(() => timelineEntries.value.length < totalVersions.value)

async function fetchTimeline(offset: number): Promise<TimelineResponse> {
  return $fetch<TimelineResponse>(`/api/registry/timeline/${packageName.value}`, {
    query: { offset, limit: PAGE_SIZE },
  })
}

// Initial load - useAsyncData serializes the full response across SSR to client
const initialLoadError = ref(false)

const { data: initialTimeline } = await useAsyncData(
  `timeline:${packageName.value}`,
  () => fetchTimeline(0),
  { watch: [packageName] },
)

watch(
  initialTimeline,
  data => {
    initialLoadError.value = false
    if (data) {
      timelineEntries.value = data.versions
      totalVersions.value = data.total
    } else {
      initialLoadError.value = true
    }
  },
  { immediate: true },
)

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  loadError.value = false
  try {
    const offset = timelineEntries.value.length
    const data = await fetchTimeline(offset)
    timelineEntries.value = [...timelineEntries.value, ...data.versions]
    totalVersions.value = data.total
    fetchSizes(offset)
  } catch {
    loadError.value = true
  } finally {
    loadingMore.value = false
  }
}

const SIZE_INCREASE_THRESHOLD = 0.25
const DEP_INCREASE_THRESHOLD = 5
const NO_LICENSE_VALUES = new Set(['', 'UNLICENSED'])

const sizeCache = shallowReactive(new Map<string, { totalSize: number; dependencyCount: number }>())
const sizeFetchesInFlight = ref(0)
const sizesLoading = computed(() => sizeFetchesInFlight.value > 0)

function sizeKey(ver: string) {
  return `${packageName.value}@${ver}`
}

async function fetchSizes(offset: number) {
  sizeFetchesInFlight.value++
  try {
    const data = await $fetch<TimelineSizeResponse>(
      `/api/registry/timeline/sizes/${packageName.value}`,
      { query: { offset, limit: PAGE_SIZE } },
    )
    for (const entry of data.sizes) {
      sizeCache.set(sizeKey(entry.version), {
        totalSize: entry.totalSize,
        dependencyCount: entry.dependencyCount,
      })
    }
  } catch {
    // silently skip - size data is best-effort
  } finally {
    sizeFetchesInFlight.value--
  }
}

// Fetch sizes for the initial page
if (import.meta.client) {
  watch(
    initialTimeline,
    () => {
      fetchSizes(0)
    },
    { immediate: true },
  )
}

const bytesFormatter = useBytesFormatter()

interface SubEvent {
  key: string
  positive: boolean
  icon: string
  text: string
}

// Detect notable changes between consecutive versions (size, license, ESM, types)
// Versions are compared against their semver predecessor, not chronological neighbor,
// so interleaved legacy releases don't produce misleading cross-line diffs.
const versionSubEvents = computed(() => {
  const result = new Map<string, SubEvent[]>()
  const entries = timelineEntries.value

  // Sort by semver to find each version's true predecessor
  const semverSorted = [...entries].sort((a, b) => compare(b.version, a.version))
  const prevBySemver = new Map<string, TimelineVersion>()
  for (let i = 0; i < semverSorted.length - 1; i++) {
    prevBySemver.set(semverSorted[i]!.version, semverSorted[i + 1]!)
  }

  for (const current of entries) {
    const previous = prevBySemver.get(current.version)
    if (!previous) continue

    const events: SubEvent[] = []

    // Size changes
    const currentSize = sizeCache.get(sizeKey(current.version))
    const previousSize = sizeCache.get(sizeKey(previous.version))
    if (currentSize && previousSize) {
      const sizeRatio =
        previousSize.totalSize > 0
          ? (currentSize.totalSize - previousSize.totalSize) / previousSize.totalSize
          : 0
      const depDiff = currentSize.dependencyCount - previousSize.dependencyCount

      const sizeIncreased = sizeRatio > SIZE_INCREASE_THRESHOLD
      const sizeDecreased = sizeRatio < -SIZE_INCREASE_THRESHOLD
      const depsIncreased = depDiff > DEP_INCREASE_THRESHOLD
      const depsDecreased = depDiff < -DEP_INCREASE_THRESHOLD

      if (sizeIncreased || sizeDecreased) {
        const sizeDelta = currentSize.totalSize - previousSize.totalSize
        events.push({
          key: 'size',
          positive: sizeDecreased,
          icon: sizeDecreased ? 'i-lucide:trending-down' : 'i-lucide:trending-up',
          text: sizeDecreased
            ? t('package.timeline.size_decrease', {
                percent: Math.abs(Math.round(sizeRatio * 100)),
                size: bytesFormatter.format(Math.abs(sizeDelta)),
              })
            : t('package.timeline.size_increase', {
                percent: Math.round(sizeRatio * 100),
                size: bytesFormatter.format(sizeDelta),
              }),
        })
      }

      if (depsIncreased || depsDecreased) {
        events.push({
          key: 'deps',
          positive: depsDecreased,
          icon: depsDecreased ? 'i-lucide:trending-down' : 'i-lucide:trending-up',
          text:
            depDiff > 0
              ? t('package.timeline.dep_increase', { count: depDiff })
              : t('package.timeline.dep_decrease', { count: Math.abs(depDiff) }),
        })
      }
    }

    // License changes
    const currentLicense = current.license ?? 'Unknown'
    const previousLicense = previous.license ?? 'Unknown'
    if (currentLicense !== previousLicense) {
      const hadNoLicense = NO_LICENSE_VALUES.has(previousLicense)
      const hasNoLicense = NO_LICENSE_VALUES.has(currentLicense)
      events.push({
        key: 'license',
        positive: hadNoLicense && !hasNoLicense,
        icon: 'i-lucide:scale',
        text: t('package.timeline.license_change', { from: previousLicense, to: currentLicense }),
      })
    }

    // ESM support changes
    const currentIsEsm = current.type === 'module'
    const previousIsEsm = previous.type === 'module'
    if (currentIsEsm && !previousIsEsm) {
      events.push({
        key: 'esm',
        positive: true,
        icon: 'i-lucide:package',
        text: t('package.timeline.esm_added'),
      })
    } else if (!currentIsEsm && previousIsEsm) {
      events.push({
        key: 'esm',
        positive: false,
        icon: 'i-lucide:package',
        text: t('package.timeline.esm_removed'),
      })
    }

    // TypeScript types changes
    if (current.hasTypes && !previous.hasTypes) {
      events.push({
        key: 'types',
        positive: true,
        icon: 'i-lucide:braces',
        text: t('package.timeline.types_added'),
      })
    } else if (!current.hasTypes && previous.hasTypes) {
      events.push({
        key: 'types',
        positive: false,
        icon: 'i-lucide:braces',
        text: t('package.timeline.types_removed'),
      })
    }

    // Trusted publisher changes
    if (current.hasTrustedPublisher && !previous.hasTrustedPublisher) {
      events.push({
        key: 'trustedPublisher',
        positive: true,
        icon: 'i-lucide:shield-check',
        text: t('package.timeline.trusted_publisher_added'),
      })
    } else if (!current.hasTrustedPublisher && previous.hasTrustedPublisher) {
      events.push({
        key: 'trustedPublisher',
        positive: false,
        icon: 'i-lucide:shield-off',
        text: t('package.timeline.trusted_publisher_removed'),
      })
    }

    // Provenance changes
    if (current.hasProvenance && !previous.hasProvenance) {
      events.push({
        key: 'provenance',
        positive: true,
        icon: 'i-lucide:fingerprint',
        text: t('package.timeline.provenance_added'),
      })
    } else if (!current.hasProvenance && previous.hasProvenance) {
      events.push({
        key: 'provenance',
        positive: false,
        icon: 'i-lucide:fingerprint',
        text: t('package.timeline.provenance_removed'),
      })
    }

    if (events.length) {
      result.set(current.version, events)
    }
  }

  return result
})

useSeoMeta({
  title: () => `Timeline - ${packageName.value} - npmx`,
  description: () => `Version timeline for ${packageName.value}`,
})
</script>

<template>
  <main class="flex-1 flex flex-col min-h-0">
    <PackageHeader
      :pkg="pkg"
      :resolved-version="version"
      :display-version="pkg?.requestedVersion"
      :latest-version="latestVersion"
      :version-url-pattern="versionUrlPattern"
      page="timeline"
    />

    <div class="container w-full py-8">
      <!-- Sizes loading indicator -->
      <div v-if="sizesLoading" class="h-0.5 mb-4 rounded-full bg-bg-muted overflow-hidden">
        <div class="h-full w-1/3 bg-accent rounded-full animate-indeterminate" />
      </div>

      <!-- Timeline -->
      <ol v-if="timelineEntries.length" class="relative border-s border-border ms-4">
        <li v-for="entry in timelineEntries" :key="entry.version" class="mb-6 ms-6">
          <!-- Dot -->
          <span
            class="absolute -start-2 flex items-center justify-center w-4 h-4 rounded-full border border-border"
            :class="entry.version === version ? 'bg-accent border-accent' : 'bg-bg-subtle'"
          />
          <!-- Content -->
          <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <LinkBase
              :to="packageRoute(entry.version)"
              class="text-sm font-medium"
              :class="entry.version === version ? 'text-accent' : ''"
              dir="ltr"
            >
              {{ entry.version }}
            </LinkBase>
            <span
              v-for="tag in entry.tags"
              :key="tag"
              class="text-3xs font-semibold uppercase tracking-wide"
              :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
            >
              {{ tag }}
            </span>
            <DateTime
              :datetime="entry.time"
              class="text-xs text-fg-subtle"
              year="numeric"
              month="short"
              day="numeric"
            />
          </div>
          <!-- Sub-events -->
          <ol
            v-if="versionSubEvents.has(entry.version)"
            class="relative border-s border-border/50 ms-3 mt-2"
          >
            <li
              v-for="ev in versionSubEvents.get(entry.version)"
              :key="ev.key"
              class="mb-2 ms-4 relative last:mb-0"
            >
              <span
                class="absolute -start-[1.375rem] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                :class="
                  ev.positive ? 'bg-green-500 border-green-600' : 'bg-amber-500 border-amber-600'
                "
              >
                <span class="w-2 h-2 text-white" :class="ev.icon" aria-hidden="true" />
              </span>
              <p
                class="text-xs"
                :class="
                  ev.positive
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-amber-700 dark:text-amber-400'
                "
              >
                {{ ev.text }}
              </p>
            </li>
          </ol>
        </li>
      </ol>

      <!-- Load more -->
      <div v-if="hasMore" class="mt-4 ms-10">
        <button
          type="button"
          class="text-sm text-accent hover:text-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ $t('package.timeline.load_more') }}
        </button>
        <p v-if="loadError" class="text-xs text-red-600 dark:text-red-400 mt-1">
          {{ $t('package.timeline.load_error') }}
        </p>
      </div>

      <!-- Error state -->
      <div v-else-if="initialLoadError" class="py-20 text-center">
        <p class="text-sm text-red-600 dark:text-red-400">
          {{ $t('package.timeline.load_error') }}
        </p>
      </div>

      <!-- Loading state -->
      <div v-else-if="!timelineEntries.length" class="py-20 text-center">
        <span class="i-svg-spinners:ring-resize w-5 h-5 text-fg-subtle" />
      </div>
    </div>
  </main>
</template>

<style scoped>
@keyframes indeterminate {
  0% {
    translate: -100%;
  }
  100% {
    translate: 400%;
  }
}

.animate-indeterminate {
  animation: indeterminate 1.5s ease-in-out infinite;
}
</style>
