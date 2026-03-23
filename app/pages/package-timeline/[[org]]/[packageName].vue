<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { compare } from 'semver'
import type { TimelineResponse, TimelineVersion } from '~~/server/api/registry/timeline/[...pkg].get'

definePageMeta({
  name: 'timeline',
  path: '/package-timeline/:org?/:packageName/v/:version',
})

const route = useRoute('timeline')

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)
const version = computed(() => route.params.version)

const { data: pkg } = usePackage(packageName)

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

function timelineRoute(ver: string): RouteLocationRaw {
  return { name: 'timeline', params: { ...route.params, version: ver } }
}

// Paginated timeline data from server
const PAGE_SIZE = 25

const timelineEntries = ref<TimelineVersion[]>([])
const totalVersions = ref(0)
const loadingMore = ref(false)

const hasMore = computed(() => timelineEntries.value.length < totalVersions.value)

async function fetchTimeline(offset: number): Promise<TimelineResponse> {
  return $fetch<TimelineResponse>(
    `/api/registry/timeline/${packageName.value}`,
    { query: { offset, limit: PAGE_SIZE } },
  )
}

// Initial load — useAsyncData serializes the full response across SSR → client
const { data: initialTimeline } = await useAsyncData(
  () => `timeline:${packageName.value}`,
  () => fetchTimeline(0),
)

watch(initialTimeline, (data) => {
  if (data) {
    timelineEntries.value = data.versions
    totalVersions.value = data.total
  }
}, { immediate: true })

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const data = await fetchTimeline(timelineEntries.value.length)
    timelineEntries.value = [...timelineEntries.value, ...data.versions]
    totalVersions.value = data.total
  }
  finally {
    loadingMore.value = false
  }
}

const SIZE_INCREASE_THRESHOLD = 0.25
const DEP_INCREASE_THRESHOLD = 5

const sizeCache = shallowReactive(new Map<string, InstallSizeResult>())
const fetchingVersions = shallowReactive(new Set<string>())

async function fetchSize(ver: string) {
  if (sizeCache.has(ver) || fetchingVersions.has(ver)) return
  fetchingVersions.add(ver)
  try {
    const data = await $fetch<InstallSizeResult>(
      `/api/registry/install-size/${packageName.value}/v/${ver}`,
    )
    sizeCache.set(ver, data)
  } catch {
    // silently skip — size data is best-effort
  } finally {
    fetchingVersions.delete(ver)
  }
}

// Fetch sizes for visible versions
if (import.meta.client) {
  watch(
    timelineEntries,
    entries => {
      for (const entry of entries) {
        fetchSize(entry.version)
      }
    },
    { immediate: true },
  )
}

interface VersionEvents {
  installSize?: {
    direction: 'increase' | 'decrease'
    sizeRatio: number
    sizeDelta: number
  }
  deps?: {
    direction: 'increase' | 'decrease'
    depDiff: number
  }
  license?: { from: string; to: string }
  esm?: 'added' | 'removed'
  types?: 'added' | 'removed'
}

// Detect notable changes between consecutive versions (size, license, ESM, types)
// Versions are compared against their semver predecessor, not chronological neighbor,
// so interleaved legacy releases don't produce misleading cross-line diffs.
const versionEvents = computed(() => {
  const events = new Map<string, VersionEvents>()
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

    const ev: VersionEvents = {}

    // Size changes
    const currentSize = sizeCache.get(current.version)
    const previousSize = sizeCache.get(previous.version)
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
        ev.installSize = {
          direction: sizeDecreased ? 'decrease' : 'increase',
          sizeRatio,
          sizeDelta: currentSize.totalSize - previousSize.totalSize,
        }
      }

      if (depsIncreased || depsDecreased) {
        ev.deps = {
          direction: depsDecreased ? 'decrease' : 'increase',
          depDiff,
        }
      }
    }

    // License changes
    const currentLicense = current.license ?? 'Unknown'
    const previousLicense = previous.license ?? 'Unknown'
    if (currentLicense !== previousLicense) {
      ev.license = { from: previousLicense, to: currentLicense }
    }

    // ESM support changes
    const currentIsEsm = current.type === 'module'
    const previousIsEsm = previous.type === 'module'
    if (currentIsEsm && !previousIsEsm) ev.esm = 'added'
    else if (!currentIsEsm && previousIsEsm) ev.esm = 'removed'

    // TypeScript types changes
    if (current.hasTypes && !previous.hasTypes) ev.types = 'added'
    else if (!current.hasTypes && previous.hasTypes) ev.types = 'removed'

    if (ev.installSize || ev.deps || ev.license || ev.esm || ev.types) {
      events.set(current.version, ev)
    }
  }

  return events
})

const bytesFormatter = useBytesFormatter()

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
              :to="timelineRoute(entry.version)"
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
          <!-- Sub-events branch -->
          <ol
            v-if="versionEvents.has(entry.version)"
            class="relative border-s border-border/50 ms-3 mt-2"
          >
            <template v-for="(ev, _) in [versionEvents.get(entry.version)!]" :key="0">
              <!-- Install size event -->
              <li v-if="ev.installSize" class="mb-2 ms-4 relative last:mb-0">
                <span
                  class="absolute -start-[calc(1rem+0.375rem)] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                  :class="
                    ev.installSize.direction === 'decrease'
                      ? 'bg-green-500 border-green-600'
                      : 'bg-amber-500 border-amber-600'
                  "
                >
                  <span
                    class="w-2 h-2 text-white"
                    :class="
                      ev.installSize.direction === 'decrease'
                        ? 'i-lucide:trending-down'
                        : 'i-lucide:trending-up'
                    "
                    aria-hidden="true"
                  />
                </span>
                <p
                  class="text-xs"
                  :class="
                    ev.installSize.direction === 'decrease'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  "
                >
                  {{
                    ev.installSize.direction === 'decrease'
                      ? $t('package.timeline.size_decrease', {
                          percent: Math.abs(Math.round(ev.installSize.sizeRatio * 100)),
                          size: bytesFormatter.format(Math.abs(ev.installSize.sizeDelta)),
                        })
                      : $t('package.timeline.size_increase', {
                          percent: Math.round(ev.installSize.sizeRatio * 100),
                          size: bytesFormatter.format(ev.installSize.sizeDelta),
                        })
                  }}
                </p>
              </li>
              <!-- Dependency count event -->
              <li v-if="ev.deps" class="mb-2 ms-4 relative last:mb-0">
                <span
                  class="absolute -start-[calc(1rem+0.375rem)] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                  :class="
                    ev.deps.direction === 'decrease'
                      ? 'bg-green-500 border-green-600'
                      : 'bg-amber-500 border-amber-600'
                  "
                >
                  <span
                    class="w-2 h-2 text-white"
                    :class="
                      ev.deps.direction === 'decrease'
                        ? 'i-lucide:trending-down'
                        : 'i-lucide:trending-up'
                    "
                    aria-hidden="true"
                  />
                </span>
                <p
                  class="text-xs"
                  :class="
                    ev.deps.direction === 'decrease'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  "
                >
                  {{
                    ev.deps.depDiff > 0
                      ? $t('package.timeline.dep_increase', { count: ev.deps.depDiff })
                      : $t('package.timeline.dep_decrease', {
                          count: Math.abs(ev.deps.depDiff),
                        })
                  }}
                </p>
              </li>
              <!-- License change -->
              <li v-if="ev.license" class="mb-2 ms-4 relative last:mb-0">
                <span
                  class="absolute -start-[calc(1rem+0.375rem)] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border bg-amber-500 border-amber-600"
                >
                  <span class="w-2 h-2 text-white i-lucide:scale" aria-hidden="true" />
                </span>
                <p class="text-xs text-amber-700 dark:text-amber-400">
                  {{
                    $t('package.timeline.license_change', {
                      from: ev.license.from,
                      to: ev.license.to,
                    })
                  }}
                </p>
              </li>
              <!-- ESM change -->
              <li v-if="ev.esm" class="mb-2 ms-4 relative last:mb-0">
                <span
                  class="absolute -start-[calc(1rem+0.375rem)] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                  :class="
                    ev.esm === 'added'
                      ? 'bg-green-500 border-green-600'
                      : 'bg-amber-500 border-amber-600'
                  "
                >
                  <span class="w-2 h-2 text-white i-lucide:package" aria-hidden="true" />
                </span>
                <p
                  class="text-xs"
                  :class="
                    ev.esm === 'added'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  "
                >
                  {{
                    ev.esm === 'added'
                      ? $t('package.timeline.esm_added')
                      : $t('package.timeline.esm_removed')
                  }}
                </p>
              </li>
              <!-- Types change -->
              <li v-if="ev.types" class="mb-2 ms-4 relative last:mb-0">
                <span
                  class="absolute -start-[calc(1rem+0.375rem)] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                  :class="
                    ev.types === 'added'
                      ? 'bg-green-500 border-green-600'
                      : 'bg-amber-500 border-amber-600'
                  "
                >
                  <span class="w-2 h-2 text-white i-lucide:braces" aria-hidden="true" />
                </span>
                <p
                  class="text-xs"
                  :class="
                    ev.types === 'added'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  "
                >
                  {{
                    ev.types === 'added'
                      ? $t('package.timeline.types_added')
                      : $t('package.timeline.types_removed')
                  }}
                </p>
              </li>
            </template>
          </ol>
        </li>
      </ol>

      <!-- Load more -->
      <div v-if="hasMore" class="mt-4 ms-10">
        <button
          type="button"
          class="text-sm text-accent hover:text-accent/80 transition-colors"
          @click="loadMore"
        >
          {{ $t('package.timeline.load_more') }}
        </button>
      </div>

      <!-- Empty state -->
      <div v-else-if="!timelineEntries.length" class="py-20 text-center">
        <span class="i-svg-spinners:ring-resize w-5 h-5 text-fg-subtle" />
      </div>
    </div>
  </main>
</template>
