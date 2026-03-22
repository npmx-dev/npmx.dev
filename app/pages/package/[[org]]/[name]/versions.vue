<script setup lang="ts">
import { WindowVirtualizer } from 'virtua/vue'
import { getVersions } from 'fast-npm-meta'
import { compare, validRange } from 'semver'
import {
  buildVersionToTagsMap,
  buildTaggedVersionRows,
  compareTagRows,
  compareVersionGroupKeys,
  filterVersions,
  getVersionGroupKey,
  getVersionGroupLabel,
} from '~/utils/versions'
import { fetchAllPackageVersions } from '~/utils/npm/api'

definePageMeta({
  name: 'package-versions',
})

/** Number of flat items (headers + version rows) to render statically during SSR */
const SSR_COUNT = 20

const route = useRoute('package-versions')

const packageName = computed(() => {
  const { org, name } = route.params
  return org ? `${org}/${name}` : name
})
const orgName = computed(() => route.params.org?.replace('@', '') ?? null)

// ─── Phase 1: lightweight fetch (page load) ───────────────────────────────────
// Fetches only version strings, dist-tags, and publish times — no deprecated/provenance metadata.
// Enough to render the "Current Tags" section and all group headers immediately.

const { data: versionSummary } = useLazyAsyncData(
  () => `package-version-summary:${packageName.value}`,
  async () => {
    const data = await getVersions(packageName.value)
    return {
      distTags: data.distTags as Record<string, string>,
      versions: data.versions,
      time: data.time as Record<string, string>,
    }
  },
  { deep: false },
)

const distTags = computed(() => versionSummary.value?.distTags ?? {})
const versionStrings = computed(() => versionSummary.value?.versions ?? [])
const versionTimes = computed(() => versionSummary.value?.time ?? {})

// ─── Phase 2: full metadata (loaded on first group expand) ────────────────────
// Fetches deprecated status, provenance, and exact times needed for version rows.

const fullVersionMap = shallowRef<Map<
  string,
  { time?: string; deprecated?: string; hasProvenance: boolean }
> | null>(null)

async function ensureFullDataLoaded() {
  if (fullVersionMap.value) return
  const versions = await fetchAllPackageVersions(packageName.value)
  fullVersionMap.value = new Map(versions.map(v => [v.version, v]))
}

// ─── Derived data ─────────────────────────────────────────────────────────────

const versionToTagsMap = computed(() => buildVersionToTagsMap(distTags.value))

const tagRows = computed(() => buildTaggedVersionRows(distTags.value))
const latestTagRow = computed(() => tagRows.value.find(r => r.tags.includes('latest')) ?? null)
const otherTagRows = computed(() =>
  tagRows.value
    .filter(r => !r.tags.includes('latest'))
    .sort((rowA, rowB) => compareTagRows(rowA, rowB, versionTimes.value)),
)

function getVersionTime(version: string): string | undefined {
  return versionTimes.value[version]
}

// ─── Version groups ───────────────────────────────────────────────────────────

const expandedGroups = ref(new Set<string>())
const loadingGroup = ref<string | null>(null)

const versionGroups = computed(() => {
  const byKey = new Map<string, string[]>()
  for (const v of versionStrings.value) {
    const key = getVersionGroupKey(v)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(v)
  }

  return Array.from(byKey.keys())
    .sort(compareVersionGroupKeys)
    .map(groupKey => ({
      groupKey,
      label: getVersionGroupLabel(groupKey),
      versions: byKey.get(groupKey)!.sort((a, b) => compare(b, a)),
    }))
})

async function toggleGroup(groupKey: string) {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
    return
  }
  expandedGroups.value.add(groupKey)
  if (!fullVersionMap.value) {
    loadingGroup.value = groupKey
    try {
      await ensureFullDataLoaded()
    } finally {
      loadingGroup.value = null
    }
  }
}

// ─── Version filter ───────────────────────────────────────────────────────────

const versionFilterInput = ref('')
const versionFilter = refDebounced(versionFilterInput, 100)
const isFilterActive = computed(() => versionFilter.value.trim() !== '')
const isInvalidRange = computed(
  () => isFilterActive.value && validRange(versionFilter.value.trim()) === null,
)

const filteredVersionSet = computed(() => {
  const trimmed = versionFilter.value.trim()
  if (!trimmed) return null
  // Try semver range first (e.g. "^2.0.0", ">=1 <3")
  if (validRange(trimmed)) {
    return filterVersions(versionStrings.value, trimmed)
  }
  // Fallback: substring match (e.g. "2.4", "beta")
  const lower = trimmed.toLowerCase()
  return new Set(versionStrings.value.filter(v => v.toLowerCase().includes(lower)))
})

const filteredGroups = computed(() => {
  if (!isFilterActive.value || !filteredVersionSet.value) return versionGroups.value
  return versionGroups.value
    .map(group =>
      Object.assign({}, group, {
        versions: group.versions.filter(v => filteredVersionSet.value!.has(v)),
      }),
    )
    .filter(group => group.versions.length > 0)
})

// ─── Flat list for virtual rendering ──────────────────────────────────────────

type FlatItem =
  | { type: 'header'; key: string; groupKey: string; label: string; versions: string[] }
  | { type: 'version'; key: string; version: string; groupKey: string }

const flatItems = computed<FlatItem[]>(() => {
  const items: FlatItem[] = []
  for (const group of filteredGroups.value) {
    items.push({
      type: 'header',
      key: `header:${group.groupKey}`,
      groupKey: group.groupKey,
      label: group.label,
      versions: group.versions,
    })
    if (expandedGroups.value.has(group.groupKey) || isFilterActive.value) {
      for (const version of group.versions) {
        items.push({
          type: 'version',
          key: `version:${version}`,
          version,
          groupKey: group.groupKey,
        })
      }
    }
  }
  return items
})

// TODO(atriiy): implement changelog side panel
// Show GitHub release notes or parsed CHANGELOG.md content per version
</script>

<template>
  <main class="flex-1 flex flex-col">
    <!-- Header -->
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink
            :to="packageRoute(packageName)"
            class="text-lg font-medium hover:text-fg-muted transition-colors min-w-0 truncate"
            :title="packageName"
            dir="ltr"
          >
            <span v-if="orgName" class="text-fg-muted">@{{ orgName }}/</span
            >{{ orgName ? packageName.replace(`@${orgName}/`, '') : packageName }}
          </NuxtLink>
          <span class="text-fg-subtle shrink-0">/</span>
          <h1 class="text-sm text-fg-muted shrink-0">{{ $t('package.versions.page_title') }}</h1>
        </div>
        <div class="relative">
          <InputBase
            v-model="versionFilterInput"
            type="text"
            :placeholder="$t('package.versions.filter_placeholder')"
            :aria-label="$t('package.versions.filter_placeholder')"
            :aria-invalid="isInvalidRange ? 'true' : undefined"
            :aria-describedby="isInvalidRange ? 'version-filter-error' : undefined"
            autocomplete="off"
            size="small"
            class="w-36 sm:w-64"
            :class="isInvalidRange ? 'pe-7 !border-red-500' : ''"
          />
          <Transition
            enter-active-class="transition-all duration-150"
            enter-from-class="opacity-0 scale-60"
            leave-active-class="transition-all duration-150"
            leave-to-class="opacity-0 scale-60"
          >
            <TooltipApp
              v-if="isInvalidRange"
              :text="$t('package.versions.filter_invalid')"
              position="bottom"
              class="absolute end-0 inset-y-0 flex items-center pe-2"
            >
              <span
                id="version-filter-error"
                class="i-lucide:circle-alert w-3.5 h-3.5 text-red-500 block"
                role="img"
                :aria-label="$t('package.versions.filter_invalid')"
              />
            </TooltipApp>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Content -->
    <div class="container w-full py-8 space-y-8">
      <!-- ── Current Tags ───────────────────────────────────────────────────── -->
      <section class="space-y-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider px-4 sm:px-6 ps-1">
          {{ $t('package.versions.current_tags') }}
        </h2>

        <!-- Latest — featured card -->
        <div
          v-if="latestTagRow"
          class="border-y sm:rounded-lg sm:border border-accent/40 bg-accent/5 px-5 py-4 relative flex items-center justify-between gap-4 hover:bg-accent/8 transition-colors"
        >
          <!-- Left: tags + version -->
          <div>
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="text-3xs font-bold uppercase tracking-widest text-accent">latest</span>
              <span
                v-for="tag in latestTagRow!.tags.filter(t => t !== 'latest')"
                :key="tag"
                class="text-3xs font-semibold uppercase tracking-wide text-fg-subtle"
                :title="tag"
                >{{ tag }}</span
              >
            </div>
            <LinkBase
              :to="packageRoute(packageName, latestTagRow!.version)"
              class="text-2xl font-semibold tracking-tight after:absolute after:inset-0 after:content-['']"
              :title="latestTagRow!.version"
              dir="ltr"
              >{{ latestTagRow!.version }}</LinkBase
            >
          </div>
          <!-- Right: date + provenance -->
          <div class="flex flex-col items-end gap-1.5 shrink-0 relative z-10">
            <ProvenanceBadge
              v-if="fullVersionMap?.get(latestTagRow!.version)?.hasProvenance"
              :package-name="packageName"
              :version="latestTagRow!.version"
              compact
              :linked="false"
            />
            <DateTime
              v-if="getVersionTime(latestTagRow!.version)"
              :datetime="getVersionTime(latestTagRow!.version)!"
              class="text-xs text-fg-subtle"
              year="numeric"
              month="short"
              day="numeric"
            />
          </div>
        </div>

        <!-- Other tags — compact list (hidden when only latest exists) -->
        <div
          v-if="otherTagRows.length > 0"
          class="border-y sm:rounded-lg sm:border border-border sm:overflow-hidden"
        >
          <div
            v-for="row in otherTagRows"
            :key="row.id"
            class="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors relative"
          >
            <!-- Tag labels -->
            <div class="w-28 shrink-0 flex flex-wrap gap-x-1.5 gap-y-0.5">
              <span
                v-for="tag in row.tags"
                :key="tag"
                class="text-3xs font-semibold uppercase tracking-wide text-fg-subtle"
                :title="tag"
                >{{ tag }}</span
              >
            </div>

            <!-- Version -->
            <LinkBase
              :to="packageRoute(packageName, row.version)"
              class="text-sm flex-1 min-w-0 after:absolute after:inset-0 after:content-['']"
              :title="row.version"
              dir="ltr"
            >
              {{ row.version }}
            </LinkBase>

            <!-- Date + Provenance -->
            <div class="flex items-center gap-2 shrink-0 relative z-10">
              <DateTime
                v-if="getVersionTime(row.version)"
                :datetime="getVersionTime(row.version)!"
                class="text-xs text-fg-subtle hidden sm:block"
                year="numeric"
                month="short"
                day="numeric"
              />
              <ProvenanceBadge
                v-if="fullVersionMap?.get(row.version)?.hasProvenance"
                :package-name="packageName"
                :version="row.version"
                compact
                :linked="false"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ── Version History ───────────────────────────────────────────────── -->
      <section v-if="versionGroups.length > 0">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 px-4 sm:px-6 ps-1">
          {{ $t('package.versions.page_title') }}
          <span class="ms-1 normal-case font-normal tracking-normal">
            ({{ versionStrings.length }})
          </span>
        </h2>

        <!-- No filter matches -->
        <div
          v-if="isFilterActive && filteredGroups.length === 0"
          class="px-1 py-4 text-sm text-fg-subtle"
          role="status"
          aria-live="polite"
        >
          {{ $t('package.versions.no_match_filter', { filter: versionFilter }) }}
        </div>

        <div
          v-else
          class="flex-1 min-w-0 self-start border-y sm:border border-border sm:rounded-lg sm:overflow-hidden"
        >
          <ClientOnly>
            <WindowVirtualizer :data="flatItems">
              <template #default="{ item, index }">
                <div :key="item.key">
                  <!-- ── Group header ── -->
                  <button
                    v-if="item.type === 'header'"
                    type="button"
                    class="flex items-center gap-3 px-4 py-2.5 w-full text-start hover:bg-bg-subtle transition-colors"
                    :class="index < flatItems.length - 1 ? 'border-b border-border' : ''"
                    :aria-expanded="expandedGroups.has(item.groupKey)"
                    @click="toggleGroup(item.groupKey)"
                  >
                    <span class="w-4 h-4 flex items-center justify-center text-fg-subtle shrink-0">
                      <Transition name="icon-swap" mode="out-in">
                        <span
                          v-if="loadingGroup === item.groupKey"
                          key="loading"
                          class="i-svg-spinners:ring-resize w-3 h-3"
                          aria-hidden="true"
                        />
                        <span
                          v-else-if="isFilterActive"
                          key="search"
                          class="i-lucide:funnel w-3 h-3"
                          aria-hidden="true"
                        />
                        <span
                          v-else
                          key="chevron"
                          class="i-lucide:chevron-right w-3 h-3 transition-transform duration-200 rtl-flip"
                          :class="expandedGroups.has(item.groupKey) ? 'rotate-90' : ''"
                          aria-hidden="true"
                        />
                      </Transition>
                    </span>
                    <span class="text-sm font-medium">{{ item.label }}</span>
                    <span class="text-xs text-fg-subtle">({{ item.versions.length }})</span>
                    <span class="ms-auto flex items-center gap-3 shrink-0">
                      <span class="text-xs text-fg-muted" :title="item.versions[0]" dir="ltr">{{
                        item.versions[0]
                      }}</span>
                      <DateTime
                        v-if="getVersionTime(item.versions[0])"
                        :datetime="getVersionTime(item.versions[0])!"
                        class="text-xs text-fg-subtle hidden sm:block"
                        year="numeric"
                        month="short"
                        day="numeric"
                      />
                    </span>
                  </button>

                  <!-- ── Version row ── -->
                  <div
                    v-else
                    class="transition-colors"
                    :class="index < flatItems.length - 1 ? 'border-b border-border' : ''"
                  >
                    <div
                      class="flex items-center gap-3 px-4 ps-11 py-2.5 group relative hover:bg-bg-subtle"
                    >
                      <!-- Version + badges -->
                      <div class="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <LinkBase
                          :to="packageRoute(packageName, item.version)"
                          :prefetch="false"
                          class="text-sm after:absolute after:inset-0 after:content-['']"
                          :class="
                            fullVersionMap?.get(item.version)?.deprecated
                              ? 'text-red-700 dark:text-red-400'
                              : ''
                          "
                          :classicon="
                            fullVersionMap?.get(item.version)?.deprecated
                              ? 'i-lucide:octagon-alert'
                              : undefined
                          "
                          :title="
                            fullVersionMap?.get(item.version)?.deprecated
                              ? $t('package.versions.deprecated_title', { version: item.version })
                              : item.version
                          "
                          dir="ltr"
                        >
                          {{ item.version }}
                        </LinkBase>
                        <div
                          v-if="versionToTagsMap.get(item.version)?.length"
                          class="flex items-center gap-1 flex-wrap relative z-10"
                        >
                          <span
                            v-for="tag in versionToTagsMap.get(item.version)"
                            :key="tag"
                            class="text-4xs font-semibold uppercase tracking-wide"
                            :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
                            :title="tag"
                          >
                            {{ tag }}
                          </span>
                        </div>
                        <span
                          v-if="fullVersionMap?.get(item.version)?.deprecated"
                          class="text-3xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded relative z-10"
                          :title="fullVersionMap.get(item.version)!.deprecated"
                        >
                          deprecated
                        </span>
                      </div>

                      <!-- Right side -->
                      <div class="flex items-center gap-2 shrink-0 relative z-10">
                        <!-- Metadata: date + provenance -->
                        <DateTime
                          v-if="getVersionTime(item.version)"
                          :datetime="getVersionTime(item.version)!"
                          class="text-xs text-fg-subtle hidden sm:block"
                          year="numeric"
                          month="short"
                          day="numeric"
                        />
                        <ProvenanceBadge
                          v-if="fullVersionMap?.get(item.version)?.hasProvenance"
                          :package-name="packageName"
                          :version="item.version"
                          compact
                          :linked="false"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </WindowVirtualizer>

            <!-- SSR fallback: static list of first group headers -->
            <template #fallback>
              <div>
                <button
                  v-for="item in versionGroups.slice(0, SSR_COUNT)"
                  :key="item.groupKey"
                  type="button"
                  class="flex items-center gap-3 px-4 py-2.5 w-full text-start border-b border-border last:border-b-0"
                  :aria-expanded="false"
                >
                  <span class="w-4 h-4 flex items-center justify-center text-fg-subtle shrink-0">
                    <span class="i-lucide:chevron-right w-3 h-3 rtl-flip" aria-hidden="true" />
                  </span>
                  <span class="text-sm font-medium">{{ item.label }}</span>
                  <span class="text-xs text-fg-subtle">({{ item.versions.length }})</span>
                  <span class="ms-auto flex items-center gap-3 shrink-0">
                    <span class="text-xs text-fg-muted" dir="ltr">{{ item.versions[0] }}</span>
                    <DateTime
                      v-if="getVersionTime(item.versions[0] ?? '')"
                      :datetime="getVersionTime(item.versions[0] ?? '')!"
                      class="text-xs text-fg-subtle hidden sm:block"
                      year="numeric"
                      month="short"
                      day="numeric"
                    />
                  </span>
                </button>
              </div>
            </template>
          </ClientOnly>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.icon-swap-enter-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.icon-swap-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
  animation: none !important;
}

.icon-swap-enter-from {
  opacity: 0;
  transform: scale(0.5);
}

.icon-swap-leave-to {
  opacity: 0;
  transform: scale(0.5);
}

</style>
