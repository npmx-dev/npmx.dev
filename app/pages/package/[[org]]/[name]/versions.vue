<script setup lang="ts">
import { WindowVirtualizer } from 'virtua/vue'
import { getVersions } from 'fast-npm-meta'
import { validRange } from 'semver'
import {
  buildVersionToTagsMap,
  buildTaggedVersionRows,
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

const route = useRoute()

const packageName = computed(() => {
  const { org, name } = route.params as { org?: string; name: string }
  return org ? `${org}/${name}` : (name as string)
})

const orgName = computed(() => {
  const name = packageName.value
  if (!name.startsWith('@')) return null
  const match = name.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

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

// TODO: Replace mockChangelogs with pre-rendered HTML from the server
//       (GitHub releases body or CHANGELOG.md, parsed server-side like README)
const mockChangelogs: Record<string, string> = {}

const versionToTagsMap = computed(() => buildVersionToTagsMap(distTags.value))
const tagRows = computed(() => buildTaggedVersionRows(distTags.value))

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
    .sort((a, b) => {
      const [aMajor, aMinor] = a.split('.').map(Number)
      const [bMajor, bMinor] = b.split('.').map(Number)
      if (aMajor !== bMajor) return (bMajor ?? 0) - (aMajor ?? 0)
      return (bMinor ?? -1) - (aMinor ?? -1)
    })
    .map(groupKey => ({
      groupKey,
      label: getVersionGroupLabel(groupKey),
      versions: byKey.get(groupKey)!,
    }))
})

async function toggleGroup(groupKey: string) {
  console.log('toggleGroup', groupKey)
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
    return
  }
  expandedGroups.value.add(groupKey)
  console.log('toggleGroup expanded', fullVersionMap.value)
  console.log('toggleGroup expanded', !fullVersionMap.value)
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

const versionFilter = ref('')
const isFilterActive = computed(() => versionFilter.value.trim() !== '')

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
    .map(group => ({
      ...group,
      versions: group.versions.filter(v => filteredVersionSet.value!.has(v)),
    }))
    .filter(group => group.versions.length > 0)
})

// ─── Flat list for virtual rendering ──────────────────────────────────────────

type FlatItem =
  | { type: 'header'; groupKey: string; label: string; versions: string[] }
  | { type: 'version'; version: string; groupKey: string }

const flatItems = computed<FlatItem[]>(() => {
  const items: FlatItem[] = []
  for (const group of filteredGroups.value) {
    items.push({
      type: 'header',
      groupKey: group.groupKey,
      label: group.label,
      versions: group.versions,
    })
    if (expandedGroups.value.has(group.groupKey) || isFilterActive.value) {
      for (const version of group.versions) {
        items.push({ type: 'version', version, groupKey: group.groupKey })
      }
    }
  }
  return items
})

// ─── Changelog side panel ─────────────────────────────────────────────────────

const selectedChangelogVersion = ref<string | null>(null)

const selectedChangelogContent = computed(() => {
  if (!selectedChangelogVersion.value) return ''
  return mockChangelogs[selectedChangelogVersion.value] ?? ''
})

// function toggleChangelog(version: string) {
//   selectedChangelogVersion.value = selectedChangelogVersion.value === version ? null : version
// }
</script>

<template>
  <main class="flex-1 flex flex-col">
    <!-- Header -->
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <NuxtLink
            :to="packageRoute(packageName)"
            class="font-mono text-lg font-medium hover:text-fg-muted transition-colors min-w-0 truncate"
            :title="packageName"
            dir="ltr"
          >
            <span v-if="orgName" class="text-fg-muted">@{{ orgName }}/</span
            >{{ orgName ? packageName.replace(`@${orgName}/`, '') : packageName }}
          </NuxtLink>
          <span class="text-fg-subtle shrink-0">/</span>
          <span class="font-mono text-sm text-fg-muted shrink-0">Version History</span>
        </div>
        <InputBase
          v-model="versionFilter"
          type="text"
          placeholder="Filter versions…"
          aria-label="Filter versions"
          size="small"
          class="w-36 sm:w-44 font-mono"
        />
      </div>
    </header>

    <!-- Content -->
    <div class="container w-full py-8 space-y-8">
      <!-- ── Current Tags ───────────────────────────────────────────────────── -->
      <section class="space-y-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider px-4 sm:px-6 ps-1">
          Current Tags
        </h2>

        <!-- Latest — featured card -->
        <div
          v-if="tagRows[0]"
          class="border-y sm:rounded-lg sm:border border-accent/40 bg-accent/5 px-5 py-4 relative flex items-center justify-between gap-4 hover:bg-accent/8 transition-colors"
        >
          <!-- Left: tags + version -->
          <div>
            <div class="flex items-center gap-2 mb-1.5 flex-wrap">
              <span class="text-3xs font-bold uppercase tracking-widest text-accent">latest</span>
              <span
                v-for="tag in tagRows[0].tags.filter(t => t !== 'latest')"
                :key="tag"
                class="text-3xs font-semibold uppercase tracking-wide text-fg-subtle"
                >{{ tag }}</span
              >
            </div>
            <LinkBase
              :to="packageRoute(packageName, tagRows[0].version)"
              class="font-mono text-2xl font-semibold tracking-tight after:absolute after:inset-0 after:content-['']"
              dir="ltr"
              >{{ tagRows[0].version }}</LinkBase
            >
          </div>
          <!-- Right: date + provenance -->
          <div class="flex flex-col items-end gap-1.5 shrink-0 relative z-10">
            <ProvenanceBadge
              v-if="fullVersionMap?.get(tagRows[0].version)?.hasProvenance"
              :package-name="packageName"
              :version="tagRows[0].version"
              compact
              :linked="false"
            />
            <DateTime
              v-if="getVersionTime(tagRows[0].version)"
              :datetime="getVersionTime(tagRows[0].version)!"
              class="text-xs text-fg-subtle"
              year="numeric"
              month="short"
              day="numeric"
            />
          </div>
        </div>

        <!-- Other tags — compact list (hidden when only latest exists) -->
        <div
          v-if="tagRows.length > 1"
          class="border-y sm:rounded-lg sm:border border-border sm:overflow-hidden"
        >
          <div
            v-for="row in tagRows.slice(1)"
            :key="row.id"
            class="flex items-center gap-4 px-4 py-2.5 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors relative"
          >
            <!-- Tag labels -->
            <div class="w-28 shrink-0 flex flex-wrap gap-x-1.5 gap-y-0.5">
              <span
                v-for="tag in row.tags"
                :key="tag"
                class="text-3xs font-semibold uppercase tracking-wide text-fg-subtle"
                >{{ tag }}</span
              >
            </div>

            <!-- Version -->
            <LinkBase
              :to="packageRoute(packageName, row.version)"
              class="font-mono text-sm flex-1 min-w-0 after:absolute after:inset-0 after:content-['']"
              dir="ltr"
            >
              {{ row.version }}
            </LinkBase>

            <!-- Date -->
            <DateTime
              v-if="getVersionTime(row.version)"
              :datetime="getVersionTime(row.version)!"
              class="text-xs text-fg-subtle shrink-0 hidden sm:block"
              year="numeric"
              month="short"
              day="numeric"
            />

            <!-- Provenance -->
            <ProvenanceBadge
              v-if="fullVersionMap?.get(row.version)?.hasProvenance"
              :package-name="packageName"
              :version="row.version"
              compact
              :linked="false"
              class="relative z-10 shrink-0"
            />
          </div>
        </div>
      </section>

      <!-- ── Version History ───────────────────────────────────────────────── -->
      <section v-if="versionGroups.length > 0">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 px-4 sm:px-6 ps-1">
          Version History
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
          No versions match <span class="font-mono">{{ versionFilter }}</span>
        </div>

        <!-- List + changelog side panel -->
        <div v-else class="flex">
          <!-- Version list (grouped by major, virtualized) -->
          <div
            class="flex-1 min-w-0 border-y sm:border border-border sm:rounded-lg sm:overflow-hidden"
          >
            <ClientOnly>
              <WindowVirtualizer :data="flatItems">
                <template #default="{ item, index }">
                  <!-- ── Group header ── -->
                  <button
                    v-if="item.type === 'header'"
                    type="button"
                    class="flex items-center gap-3 px-4 py-2.5 w-full text-start hover:bg-bg-subtle transition-colors"
                    :class="index < flatItems.length - 1 ? 'border-b border-border' : ''"
                    :aria-expanded="expandedGroups.has(item.groupKey)"
                    :aria-label="`${expandedGroups.has(item.groupKey) ? 'Collapse' : 'Expand'} ${item.label}`"
                    @click="toggleGroup(item.groupKey)"
                  >
                    <span class="w-4 h-4 flex items-center justify-center text-fg-subtle shrink-0">
                      <span
                        v-if="loadingGroup === item.groupKey"
                        class="i-svg-spinners:ring-resize w-3 h-3"
                        aria-hidden="true"
                      />
                      <span
                        v-else
                        class="i-lucide:chevron-right w-3 h-3 transition-transform duration-200 rtl-flip"
                        :class="expandedGroups.has(item.groupKey) ? 'rotate-90' : ''"
                        aria-hidden="true"
                      />
                    </span>
                    <span class="font-mono text-sm font-medium">{{ item.label }}</span>
                    <span class="text-xs text-fg-subtle">({{ item.versions.length }})</span>
                    <span class="ms-auto flex items-center gap-3 shrink-0">
                      <span class="font-mono text-xs text-fg-muted" dir="ltr">{{
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
                    :class="[
                      index < flatItems.length - 1 ? 'border-b border-border' : '',
                      selectedChangelogVersion === item.version ? 'bg-bg-subtle' : '',
                    ]"
                  >
                    <div
                      class="flex items-center gap-3 px-4 ps-11 py-2.5 group relative"
                      :class="selectedChangelogVersion === item.version ? '' : 'hover:bg-bg-subtle'"
                    >
                      <!-- Version + badges -->
                      <div class="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <LinkBase
                          :to="packageRoute(packageName, item.version)"
                          :prefetch="false"
                          class="font-mono text-sm after:absolute after:inset-0 after:content-['']"
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
                        <!-- TODO(atriiy): changelog would be implemented later -->

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

                    <!-- Mobile inline changelog (below the row, sm and up uses side panel) -->
                    <div
                      v-if="item.version in mockChangelogs"
                      class="grid sm:hidden transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                      :class="
                        selectedChangelogVersion === item.version
                          ? 'grid-rows-[1fr]'
                          : 'grid-rows-[0fr]'
                      "
                    >
                      <div class="overflow-hidden">
                        <div class="changelog-body border-t border-border px-4 py-3 text-sm">
                          {{
                            selectedChangelogVersion === item.version
                              ? selectedChangelogContent
                              : ''
                          }}
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
                    class="flex items-center gap-3 px-4 py-2.5 w-full text-start border-b border-border"
                    :aria-expanded="false"
                    :aria-label="`Expand ${item.label}`"
                  >
                    <span class="w-4 h-4 flex items-center justify-center text-fg-subtle shrink-0">
                      <span class="i-lucide:chevron-right w-3 h-3 rtl-flip" aria-hidden="true" />
                    </span>
                    <span class="font-mono text-sm font-medium">{{ item.label }}</span>
                    <span class="text-xs text-fg-subtle">({{ item.versions.length }})</span>
                    <span class="ms-auto flex items-center gap-3 shrink-0">
                      <span class="font-mono text-xs text-fg-muted" dir="ltr">{{
                        item.versions[0]
                      }}</span>
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

          <!-- Changelog side panel (desktop only) -->
          <div
            class="hidden sm:block overflow-clip shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            :class="selectedChangelogVersion ? 'w-[28rem] ms-6' : 'w-0'"
          >
            <!-- Fixed-width inner keeps content from squishing during animation -->
            <div class="w-[28rem] sticky top-34">
              <div class="rounded-lg border border-border overflow-hidden">
                <!-- Panel header -->
                <div
                  class="flex items-center justify-between px-4 py-2.5 bg-bg-subtle border-b border-border"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span
                      class="i-lucide:scroll-text w-3.5 h-3.5 text-fg-subtle shrink-0"
                      aria-hidden="true"
                    />
                    <span class="font-mono text-sm font-medium truncate" dir="ltr">
                      v{{ selectedChangelogVersion }}
                    </span>
                  </div>
                  <button
                    type="button"
                    class="text-fg-subtle hover:text-fg transition-colors rounded focus-visible:outline-accent/70 shrink-0 ms-2"
                    aria-label="Close changelog"
                    @click="selectedChangelogVersion = null"
                  >
                    <span class="i-lucide:x w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <!-- Panel body — scrollable for long content -->
                <div
                  class="changelog-body overflow-y-auto max-h-[calc(100vh-12rem)] px-4 py-3 text-sm"
                >
                  {{ selectedChangelogContent }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
/* Changelog panel prose styles — mirrors readme.vue conventions */
.changelog-body {
  color: var(--fg-muted);
  line-height: 1.6;
  overflow-wrap: break-word;
  word-break: break-word;
}
</style>
