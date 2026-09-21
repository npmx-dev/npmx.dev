<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type {
  TimelineResponse,
  TimelineVersion,
  SubEvent,
  TimelineSort,
} from '~~/server/api/registry/timeline/[...pkg].get'
import type { TimelineSizeResponse } from '~~/server/api/registry/timeline/sizes/[...pkg].get'
import type { TimelineSizeCacheValue } from '~/utils/charts'

definePageMeta({
  name: 'timeline',
  path: '/package-timeline/:org?/:packageName/v/:version',
  preserveScrollOnQuery: true,
})

const { t } = useI18n()

const route = useRoute('timeline')

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)
const version = computed(() => route.params.version)

const { data: pkg } = usePackage(packageName, version)
const { versions: commandPaletteVersions, ensureLoaded: ensureCommandPaletteVersionsLoaded } =
  useCommandPalettePackageVersions(packageName)

const latestVersion = computed(() => {
  if (!pkg.value) return null
  const latestTag = pkg.value['dist-tags']?.latest
  if (!latestTag) return null
  return pkg.value.versions[latestTag] ?? null
})

const commandPalettePackageContext = computed(() => {
  const packageData = pkg.value
  if (!packageData) return null

  return {
    packageName: packageData.name,
    resolvedVersion: version.value ?? packageData['dist-tags']?.latest ?? null,
    latestVersion: packageData['dist-tags']?.latest ?? null,
    versions: commandPaletteVersions.value ?? Object.keys(packageData.versions ?? {}),
  }
})

useCommandPalettePackageContext(commandPalettePackageContext, {
  onOpen: ensureCommandPaletteVersionsLoaded,
})
useCommandPalettePackageCommands(commandPalettePackageContext)

const versionUrlPattern = computed(() => {
  const { org, packageName: name } = route.params
  return `/package-timeline/${org ? `${org}/` : ''}${name}/v/{version}`
})

useCommandPaletteVersionCommands(commandPalettePackageContext, nextVersion =>
  packageTimelineRoute(packageName.value, nextVersion),
)

function packageRoute(ver: string): RouteLocationRaw {
  return {
    name: 'package-version',
    params: { org: route.params.org, name: route.params.packageName, version: ver },
  }
}

// Sort order, persisted in the query string (default semver, omitted from URL)
const sort = usePermalink<TimelineSort>('sort', 'semver')

// "Stable only" filter, shared with the chart via the query string. Applied
// server-side so pagination totals and pages already exclude pre-releases.
const stableOnly = useTimelineStableOnly()

// Paginated timeline data from server
const PAGE_SIZE = 25

const timelineEntries = ref<TimelineVersion[]>([])
const totalVersions = ref(0)
const loadingMore = ref(false)
const loadError = ref(false)

const hasMore = computed(() => timelineEntries.value.length < totalVersions.value)

async function fetchTimeline(
  offset: number,
  pkgName: string = packageName.value,
  sortOrder: TimelineSort = sort.value,
  stable: boolean = stableOnly.value,
): Promise<TimelineResponse> {
  return $fetch<TimelineResponse>(`/api/registry/timeline/${pkgName}`, {
    query: { offset, 'limit': PAGE_SIZE, 'sort': sortOrder, 'stable-only': String(stable) },
  })
}

// Initial load - useAsyncData serializes the full response across SSR to client.
// The key is a stable string (evaluated once); subsequent package/sort/filter
// changes are handled by the reload watcher below so we control the page size.
const initialLoadError = ref(false)

const { data: initialTimeline, status: initialStatus } = await useAsyncData(
  `timeline:${packageName.value}:${sort.value}:${stableOnly.value}`,
  () => fetchTimeline(0),
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
  // Capture the request context; the package, sort or filter can change while
  // the request is in flight, after which the reload watcher replaces the list.
  const pkgName = packageName.value
  const sortOrder = sort.value
  const stable = stableOnly.value
  const isStale = () =>
    pkgName !== packageName.value || sortOrder !== sort.value || stable !== stableOnly.value
  try {
    const offset = timelineEntries.value.length
    const data = await fetchTimeline(offset, pkgName, sortOrder, stable)
    if (isStale()) return
    timelineEntries.value = [...timelineEntries.value, ...data.versions]
    totalVersions.value = data.total
    fetchSizes(offset, pkgName, sortOrder, stable)
  } catch {
    if (!isStale()) loadError.value = true
  } finally {
    loadingMore.value = false
  }
}

const SIZE_INCREASE_THRESHOLD = 0.25
const DEP_INCREASE_THRESHOLD = 5
const NO_LICENSE_VALUES = new Set(['', 'UNLICENSED'])

const sizeCache = shallowReactive(new Map<string, TimelineSizeCacheValue>())
const sizeFetchesInFlight = ref(0)
const sizesLoading = computed(() => sizeFetchesInFlight.value > 0)

function sizeKey(ver: string) {
  return `${packageName.value}@${ver}`
}

async function fetchSizes(
  offset: number,
  pkgName: string = packageName.value,
  sortOrder: TimelineSort = sort.value,
  stable: boolean = stableOnly.value,
) {
  sizeFetchesInFlight.value++
  try {
    const data = await $fetch<TimelineSizeResponse>(`/api/registry/timeline/sizes/${pkgName}`, {
      query: { offset, 'limit': PAGE_SIZE, 'sort': sortOrder, 'stable-only': String(stable) },
    })
    if (pkgName !== packageName.value || sortOrder !== sort.value || stable !== stableOnly.value) {
      return
    }

    for (const entry of data.sizes) {
      sizeCache.set(`${pkgName}@${entry.version}`, {
        totalSize: entry.totalSize,
        dependencyCount: entry.dependencyCount,
        selfSize: entry.selfSize,
        dependencies: entry.dependencies,
      })
    }
  } catch {
    // silently skip - size data is best-effort
  } finally {
    sizeFetchesInFlight.value--
  }
}

// Fetch sizes for the first `pageCount` pages (one request per page).
function fetchSizesPages(
  pageCount: number,
  pkgName: string = packageName.value,
  sortOrder: TimelineSort = sort.value,
  stable: boolean = stableOnly.value,
) {
  for (let page = 0; page < pageCount; page++) {
    fetchSizes(page * PAGE_SIZE, pkgName, sortOrder, stable)
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

  // When the package, sort or stable-only filter changes, re-fetch as many
  // PAGE_SIZE pages as the user had already paginated (a package change starts
  // fresh from page one) so their position is preserved. Fetching per page reuses
  // each page's cache instead of issuing one oversized request.
  watch([packageName, sort, stableOnly], async ([pkgName, sortOrder, stable], [previousPkg]) => {
    loadError.value = false
    const pageCount =
      pkgName === previousPkg ? Math.max(1, Math.ceil(timelineEntries.value.length / PAGE_SIZE)) : 1
    const isStale = () =>
      pkgName !== packageName.value || sortOrder !== sort.value || stable !== stableOnly.value
    try {
      const pages = await Promise.all(
        Array.from({ length: pageCount }, (_, page) =>
          fetchTimeline(page * PAGE_SIZE, pkgName, sortOrder, stable),
        ),
      )
      if (isStale()) return
      timelineEntries.value = pages.flatMap(page => page.versions)
      totalVersions.value = pages[0]?.total ?? 0
      fetchSizesPages(pageCount, pkgName, sortOrder, stable)
    } catch {
      if (!isStale()) initialLoadError.value = true
    }
  })
}

const bytesFormatter = useBytesFormatter()

// Detect notable changes between consecutive versions (size, license, ESM, types).
// Each version is compared against the item immediately after it in the
// filtered/sorted list (its neighbour in the current view), so the notes reflect
// whatever ordering and filtering the user has chosen.
const versionSubEvents = computed(() => {
  const result = new Map<string, SubEvent[]>()
  const entries = timelineEntries.value

  for (let i = 0; i < entries.length; i++) {
    const current = entries[i]!
    const events: SubEvent[] = []

    // Deprecation (on every deprecated version, matching the versions page)
    if (current.deprecated) {
      events.push({
        key: 'deprecated',
        state: 'error',
        icon: 'i-lucide:octagon-alert',
        text: `${t('package.timeline.deprecated')}: "${current.deprecated}"`,
      })
    }

    // The list is descending (newest / highest first), so the previous release
    // is the next item down the list.
    const previous = entries[i + 1]
    if (!previous) {
      if (events.length) result.set(current.version, events)
      continue
    }

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
          state: sizeDecreased ? 'success' : 'warn',
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
          state: depsDecreased ? 'success' : 'warn',
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
        state: hadNoLicense && !hasNoLicense ? 'success' : 'warn',
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
        state: 'success',
        icon: 'i-lucide:package',
        text: t('package.timeline.esm_added'),
      })
    } else if (!currentIsEsm && previousIsEsm) {
      events.push({
        key: 'esm',
        state: 'warn',
        icon: 'i-lucide:package',
        text: t('package.timeline.esm_removed'),
      })
    }

    // TypeScript types changes
    if (current.hasTypes && !previous.hasTypes) {
      events.push({
        key: 'types',
        state: 'success',
        icon: 'i-lucide:braces',
        text: t('package.timeline.types_added'),
      })
    } else if (!current.hasTypes && previous.hasTypes) {
      events.push({
        key: 'types',
        state: 'warn',
        icon: 'i-lucide:braces',
        text: t('package.timeline.types_removed'),
      })
    }

    // Trusted publisher changes
    if (current.hasTrustedPublisher && !previous.hasTrustedPublisher) {
      events.push({
        key: 'trustedPublisher',
        state: 'success',
        icon: 'i-lucide:shield-check',
        text: t('package.timeline.trusted_publisher_added'),
      })
    } else if (!current.hasTrustedPublisher && previous.hasTrustedPublisher) {
      events.push({
        key: 'trustedPublisher',
        state: 'warn',
        icon: 'i-lucide:shield-off',
        text: t('package.timeline.trusted_publisher_removed'),
      })
    }

    // Provenance changes
    if (current.hasProvenance && !previous.hasProvenance) {
      events.push({
        key: 'provenance',
        state: 'success',
        icon: 'i-lucide:fingerprint',
        text: t('package.timeline.provenance_added'),
      })
    } else if (!current.hasProvenance && previous.hasProvenance) {
      events.push({
        key: 'provenance',
        state: 'warn',
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

const selectedVersion = shallowRef<string | null>(null)

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

    <div class="[@media(min-height:1024px)]:sticky top-24 z-1 bg-bg mt-8">
      <div class="container w-full">
        <div class="mx-auto">
          <PackageTimelineChart
            :sizeCache
            :versionSubEvents
            :timelineEntries
            :selectedVersion
            :loading="sizesLoading"
          />
        </div>
      </div>
    </div>

    <div class="container w-full py-8">
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
              @mouseenter="selectedVersion = entry.version"
              @mouseleave="selectedVersion = null"
              @focus="selectedVersion = entry.version"
              @blur="selectedVersion = null"
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
                  ev.state === 'success'
                    ? 'bg-green-500 border-green-600'
                    : ev.state === 'error'
                      ? 'bg-red-500 border-red-600'
                      : 'bg-amber-500 border-amber-600'
                "
              >
                <span class="w-2 h-2 text-white" :class="ev.icon" aria-hidden="true" />
              </span>
              <p
                class="text-xs"
                :class="
                  ev.state === 'success'
                    ? 'text-green-700 dark:text-green-400'
                    : ev.state === 'error'
                      ? 'text-red-700 dark:text-red-400'
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
      <div
        v-else-if="!timelineEntries.length && initialStatus === 'pending'"
        class="py-20 text-center"
      >
        <span class="i-svg-spinners:ring-resize w-5 h-5 text-fg-subtle" />
      </div>

      <!-- Empty state: nothing to show (e.g. the stable-only filter hid every version) -->
      <div v-else-if="!timelineEntries.length" class="py-20 text-center">
        <p class="text-sm text-fg-subtle">
          {{ $t('package.timeline.no_stable_versions') }}
        </p>
      </div>
    </div>
  </main>
</template>
