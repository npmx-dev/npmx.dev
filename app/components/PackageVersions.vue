<script setup lang="ts">
import type { PackageVersionInfo, PackumentVersion } from '#shared/types'
import { compare } from 'semver'
import type { RouteLocationRaw } from 'vue-router'
import { fetchAllPackageVersions } from '~/composables/useNpmRegistry'
import {
  buildVersionToTagsMap,
  filterExcludedTags,
  getPrereleaseChannel,
  getVersionGroupKey,
  getVersionGroupLabel,
  isSameVersionGroup,
} from '~/utils/versions'

const props = defineProps<{
  packageName: string
  versions: Record<string, PackumentVersion>
  distTags: Record<string, string>
  time: Record<string, string>
}>()

/** Maximum number of dist-tag rows to show before collapsing into "Other versions" */
const MAX_VISIBLE_TAGS = 10

/** A version with its metadata */
interface VersionDisplay {
  version: string
  time?: string
  tags?: string[]
  hasProvenance: boolean
  deprecated?: string
}

// Check if a version has provenance/attestations
function hasProvenance(version: PackumentVersion | undefined): boolean {
  if (!version?.dist) return false
  const dist = version.dist as { attestations?: unknown }
  return !!dist.attestations
}

// Build route object for package version link
function versionRoute(version: string): RouteLocationRaw {
  return {
    name: 'package',
    params: { package: [...props.packageName.split('/'), 'v', version] },
  }
}

// Version to tags lookup (supports multiple tags per version)
const versionToTags = computed(() => buildVersionToTagsMap(props.distTags))

// All tag rows derived from props (SSR-safe)
// Deduplicates so each version appears only once, with all its tags
const allTagRows = computed(() => {
  // Group tags by version with their metadata
  const versionMap = new Map<
    string,
    { tags: string[]; versionData: PackumentVersion | undefined }
  >()
  for (const [tag, version] of Object.entries(props.distTags)) {
    const existing = versionMap.get(version)
    if (existing) {
      existing.tags.push(tag)
    } else {
      versionMap.set(version, {
        tags: [tag],
        versionData: props.versions[version],
      })
    }
  }

  // Sort tags within each version: 'latest' first, then alphabetically
  for (const entry of versionMap.values()) {
    entry.tags.sort((a, b) => {
      if (a === 'latest') return -1
      if (b === 'latest') return 1
      return a.localeCompare(b)
    })
  }

  // Convert to rows, using the first (most important) tag as the primary
  return Array.from(versionMap.entries())
    .map(([version, { tags, versionData }]) => ({
      id: `version:${version}`,
      tag: tags[0]!, // Primary tag for expand/collapse logic
      tags, // All tags for this version
      primaryVersion: {
        version,
        time: props.time[version],
        tags,
        hasProvenance: hasProvenance(versionData),
        deprecated: versionData?.deprecated,
      } as VersionDisplay,
    }))
    .sort((a, b) => compare(b.primaryVersion.version, a.primaryVersion.version))
})

// Check if the whole package is deprecated (latest version is deprecated)
const isPackageDeprecated = computed(() => {
  const latestVersion = props.distTags.latest
  if (!latestVersion) return false
  return !!props.versions[latestVersion]?.deprecated
})

// Visible tag rows: limited to MAX_VISIBLE_TAGS
// If package is NOT deprecated, filter out deprecated tags from visible list
const visibleTagRows = computed(() => {
  const rows = isPackageDeprecated.value
    ? allTagRows.value
    : allTagRows.value.filter(row => !row.primaryVersion.deprecated)
  const first = rows.slice(0, MAX_VISIBLE_TAGS)
  const latestTagRow = rows.find(row => row.tag === 'latest')
  // Ensure 'latest' tag is always included (at the end) if not already present
  if (latestTagRow && !first.includes(latestTagRow)) {
    first.pop()
    first.push(latestTagRow)
  }
  return first
})

// Hidden tag rows (all other tags) - shown in "Other versions"
const hiddenTagRows = computed(() =>
  allTagRows.value.filter(row => !visibleTagRows.value.includes(row)),
)

// Client-side state for expansion and loaded versions
const expandedTags = ref<Set<string>>(new Set())
const tagVersions = ref<Map<string, VersionDisplay[]>>(new Map())
const loadingTags = ref<Set<string>>(new Set())

const otherVersionsExpanded = shallowRef(false)
const expandedMajorGroups = ref<Set<string>>(new Set())
const otherMajorGroups = shallowRef<
  Array<{ groupKey: string; label: string; versions: VersionDisplay[] }>
>([])
const otherVersionsLoading = shallowRef(false)

// Cached full version list (local to component instance)
const allVersionsCache = shallowRef<PackageVersionInfo[] | null>(null)
const loadingVersions = shallowRef(false)
const hasLoadedAll = shallowRef(false)

// Load all versions using shared function
async function loadAllVersions(): Promise<PackageVersionInfo[]> {
  if (allVersionsCache.value) return allVersionsCache.value

  if (loadingVersions.value) {
    await new Promise<void>(resolve => {
      const unwatch = watch(allVersionsCache, val => {
        if (val) {
          unwatch()
          resolve()
        }
      })
    })
    return allVersionsCache.value!
  }

  loadingVersions.value = true
  try {
    const versions = await fetchAllPackageVersions(props.packageName)
    allVersionsCache.value = versions
    hasLoadedAll.value = true
    return versions
  } finally {
    loadingVersions.value = false
  }
}

// Process loaded versions
function processLoadedVersions(allVersions: PackageVersionInfo[]) {
  const distTags = props.distTags

  // For each tag, find versions in its channel (same major + same prerelease channel)
  const claimedVersions = new Set<string>()

  for (const row of allTagRows.value) {
    const tagVersion = distTags[row.tag]
    if (!tagVersion) continue

    const tagChannel = getPrereleaseChannel(tagVersion)

    // Find all versions in the same version group + prerelease channel
    // For 0.x versions, this means same major.minor; for 1.x+, same major
    const channelVersions = allVersions
      .filter(v => {
        const vChannel = getPrereleaseChannel(v.version)
        return isSameVersionGroup(v.version, tagVersion) && vChannel === tagChannel
      })
      .sort((a, b) => compare(b.version, a.version))
      .map(v => ({
        version: v.version,
        time: v.time,
        tags: versionToTags.value.get(v.version),
        hasProvenance: v.hasProvenance,
        deprecated: v.deprecated,
      }))

    tagVersions.value.set(row.tag, channelVersions)

    for (const v of channelVersions) {
      claimedVersions.add(v.version)
    }
  }

  // Group unclaimed versions by version group key
  // For 0.x versions, group by major.minor (e.g., "0.9", "0.10")
  // For 1.x+, group by major (e.g., "1", "2")
  const byGroupKey = new Map<string, VersionDisplay[]>()

  for (const v of allVersions) {
    if (claimedVersions.has(v.version)) continue

    const groupKey = getVersionGroupKey(v.version)
    if (!byGroupKey.has(groupKey)) {
      byGroupKey.set(groupKey, [])
    }
    byGroupKey.get(groupKey)!.push({
      version: v.version,
      time: v.time,
      tags: versionToTags.value.get(v.version),
      hasProvenance: v.hasProvenance,
      deprecated: v.deprecated,
    })
  }

  // Sort within each group
  for (const versions of byGroupKey.values()) {
    versions.sort((a, b) => compare(b.version, a.version))
  }

  // Build groups sorted by group key descending
  // Sort: "2", "1", "0.10", "0.9" (numerically descending)
  const sortedGroupKeys = Array.from(byGroupKey.keys()).sort((a, b) => {
    const [aMajor, aMinor] = a.split('.').map(Number)
    const [bMajor, bMinor] = b.split('.').map(Number)
    if (aMajor !== bMajor) return (bMajor ?? 0) - (aMajor ?? 0)
    return (bMinor ?? -1) - (aMinor ?? -1)
  })
  otherMajorGroups.value = sortedGroupKeys.map(groupKey => ({
    groupKey,
    label: getVersionGroupLabel(groupKey),
    versions: byGroupKey.get(groupKey)!,
  }))
  expandedMajorGroups.value.clear()
}

// Expand a tag row
async function expandTagRow(tag: string) {
  if (expandedTags.value.has(tag)) {
    expandedTags.value.delete(tag)
    expandedTags.value = new Set(expandedTags.value)
    return
  }

  if (!hasLoadedAll.value) {
    loadingTags.value.add(tag)
    loadingTags.value = new Set(loadingTags.value)
    try {
      const allVersions = await loadAllVersions()
      processLoadedVersions(allVersions)
    } catch (error) {
      // oxlint-disable-next-line no-console -- error logging
      console.error('Failed to load versions:', error)
    } finally {
      loadingTags.value.delete(tag)
      loadingTags.value = new Set(loadingTags.value)
    }
  }

  expandedTags.value.add(tag)
  expandedTags.value = new Set(expandedTags.value)
}

// Expand "Other versions" section
async function expandOtherVersions() {
  if (otherVersionsExpanded.value) {
    otherVersionsExpanded.value = false
    return
  }

  if (!hasLoadedAll.value) {
    otherVersionsLoading.value = true
    try {
      const allVersions = await loadAllVersions()
      processLoadedVersions(allVersions)
    } catch (error) {
      // oxlint-disable-next-line no-console -- error logging
      console.error('Failed to load versions:', error)
    } finally {
      otherVersionsLoading.value = false
    }
  }

  otherVersionsExpanded.value = true
}

// Toggle a version group
function toggleMajorGroup(groupKey: string) {
  if (expandedMajorGroups.value.has(groupKey)) {
    expandedMajorGroups.value.delete(groupKey)
  } else {
    expandedMajorGroups.value.add(groupKey)
  }
}

// Get versions for a tag (from loaded data or empty)
function getTagVersions(tag: string): VersionDisplay[] {
  return tagVersions.value.get(tag) ?? []
}
</script>

<template>
  <CollapsibleSection
    v-if="allTagRows.length > 0"
    :title="$t('package.versions.title')"
    id="versions"
  >
    <div class="space-y-0.5 min-w-0">
      <!-- Dist-tag rows (limited to MAX_VISIBLE_TAGS) -->
      <div v-for="row in visibleTagRows" :key="row.id">
        <div
          class="flex items-center gap-2 pe-2"
          :class="row.tag === 'latest' ? 'bg-bg-subtle rounded-lg' : ''"
        >
          <!-- Expand button (only if there are more versions to show) -->
          <button
            v-if="getTagVersions(row.tag).length > 1 || !hasLoadedAll"
            type="button"
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-muted focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-sm"
            :aria-expanded="expandedTags.has(row.tag)"
            :aria-label="
              expandedTags.has(row.tag)
                ? $t('package.versions.collapse', { tag: row.tag })
                : $t('package.versions.expand', { tag: row.tag })
            "
            data-testid="tag-expand-button"
            @click="expandTagRow(row.tag)"
          >
            <span
              v-if="loadingTags.has(row.tag)"
              class="i-carbon:rotate-180 w-3 h-3 motion-safe:animate-spin"
              data-testid="loading-spinner"
              aria-hidden="true"
            />
            <span
              v-else
              class="w-3 h-3 transition-transform duration-200 rtl-flip"
              :class="
                expandedTags.has(row.tag) ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right'
              "
              aria-hidden="true"
            />
          </button>
          <span v-else class="w-4" />

          <!-- Version info -->
          <div class="flex-1 py-1.5 min-w-0 flex gap-2 justify-between items-center">
            <div class="overflow-hidden">
              <div>
                <NuxtLink
                  :to="versionRoute(row.primaryVersion.version)"
                  class="block font-mono text-sm transition-colors duration-200 truncate inline-flex items-center gap-1"
                  :class="
                    row.primaryVersion.deprecated
                      ? 'text-red-400 hover:text-red-300'
                      : 'text-fg-muted hover:text-fg'
                  "
                  :title="
                    row.primaryVersion.deprecated
                      ? $t('package.versions.deprecated_title', {
                          version: row.primaryVersion.version,
                        })
                      : row.primaryVersion.version
                  "
                >
                  <span
                    v-if="row.primaryVersion.deprecated"
                    class="i-carbon-warning-hex w-3.5 h-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  {{ row.primaryVersion.version }}
                </NuxtLink>
              </div>
              <div v-if="row.tags.length" class="flex items-center gap-1 mt-0.5 flex-wrap">
                <span
                  v-for="tag in row.tags"
                  :key="tag"
                  class="text-[9px] font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[150px]"
                  :title="tag"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <DateTime
                v-if="row.primaryVersion.time"
                :datetime="row.primaryVersion.time"
                year="numeric"
                month="short"
                day="numeric"
                class="text-xs text-fg-subtle"
              />
              <ProvenanceBadge
                v-if="row.primaryVersion.hasProvenance"
                :package-name="packageName"
                :version="row.primaryVersion.version"
                compact
              />
            </div>
          </div>
        </div>

        <!-- Expanded versions -->
        <div
          v-if="expandedTags.has(row.tag) && getTagVersions(row.tag).length > 1"
          class="ms-4 ps-2 border-is border-border space-y-0.5 pe-2"
        >
          <div v-for="v in getTagVersions(row.tag).slice(1)" :key="v.version" class="py-1">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="versionRoute(v.version)"
                class="block font-mono text-xs transition-colors duration-200 truncate inline-flex items-center gap-1"
                :class="
                  v.deprecated
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-fg-subtle hover:text-fg-muted'
                "
                :title="
                  v.deprecated
                    ? $t('package.versions.deprecated_title', { version: v.version })
                    : v.version
                "
              >
                <span
                  v-if="v.deprecated"
                  class="i-carbon-warning-hex w-3 h-3 shrink-0"
                  aria-hidden="true"
                />
                {{ v.version }}
              </NuxtLink>
              <div class="flex items-center gap-2 shrink-0">
                <DateTime
                  v-if="v.time"
                  :datetime="v.time"
                  class="text-[10px] text-fg-subtle"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
                <ProvenanceBadge
                  v-if="v.hasProvenance"
                  :package-name="packageName"
                  :version="v.version"
                  compact
                />
              </div>
            </div>
            <div
              v-if="v.tags?.length && filterExcludedTags(v.tags, row.tags).length"
              class="flex items-center gap-1 mt-0.5"
            >
              <span
                v-for="tag in filterExcludedTags(v.tags, row.tags)"
                :key="tag"
                class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
                :title="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Other versions section -->
      <div class="pt-1">
        <button
          type="button"
          class="flex items-center gap-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-muted focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-sm"
          :aria-expanded="otherVersionsExpanded"
          :aria-label="
            otherVersionsExpanded
              ? $t('package.versions.collapse_other')
              : $t('package.versions.expand_other')
          "
          @click="expandOtherVersions"
        >
          <span
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors"
          >
            <span
              v-if="otherVersionsLoading"
              class="i-carbon:rotate-180 w-3 h-3 motion-safe:animate-spin"
              data-testid="loading-spinner"
              aria-hidden="true"
            />
            <span
              v-else
              class="w-3 h-3 transition-transform duration-200 rtl-flip"
              :class="otherVersionsExpanded ? 'i-carbon:chevron-down' : 'i-carbon:chevron-right'"
              aria-hidden="true"
            />
          </span>
          <span class="text-xs text-fg-muted py-1.5">
            {{ $t('package.versions.other_versions') }}
            <span v-if="hiddenTagRows.length > 0" class="text-fg-subtle">
              ({{
                $t(
                  'package.versions.more_tagged',
                  { count: hiddenTagRows.length },
                  hiddenTagRows.length,
                )
              }})
            </span>
          </span>
        </button>

        <!-- Expanded other versions -->
        <div v-if="otherVersionsExpanded" class="ms-4 ps-2 border-is border-border space-y-0.5">
          <!-- Hidden tag rows (overflow from visible tags) -->
          <div v-for="row in hiddenTagRows" :key="row.id" class="py-1">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="versionRoute(row.primaryVersion.version)"
                class="block font-mono text-xs transition-colors duration-200 truncate inline-flex items-center gap-1"
                :class="
                  row.primaryVersion.deprecated
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-fg-muted hover:text-fg'
                "
                :title="
                  row.primaryVersion.deprecated
                    ? $t('package.versions.deprecated_title', {
                        version: row.primaryVersion.version,
                      })
                    : row.primaryVersion.version
                "
              >
                <span
                  v-if="row.primaryVersion.deprecated"
                  class="i-carbon-warning-hex w-3 h-3 shrink-0"
                  aria-hidden="true"
                />
                {{ row.primaryVersion.version }}
              </NuxtLink>
              <div class="flex items-center gap-2 shrink-0 pe-2">
                <DateTime
                  v-if="row.primaryVersion.time"
                  :datetime="row.primaryVersion.time"
                  class="text-[10px] text-fg-subtle"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
              </div>
            </div>
            <div v-if="row.tags.length" class="flex items-center gap-1 mt-0.5 flex-wrap">
              <span
                v-for="tag in row.tags"
                :key="tag"
                class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
                :title="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- Version groups (untagged versions) -->
          <template v-if="otherMajorGroups.length > 0">
            <div v-for="group in otherMajorGroups" :key="group.groupKey">
              <!-- Version group header -->
              <div v-if="group.versions.length > 1" class="py-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-muted focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded-sm"
                      :aria-expanded="expandedMajorGroups.has(group.groupKey)"
                      :aria-label="
                        expandedMajorGroups.has(group.groupKey)
                          ? $t('package.versions.collapse_major', { major: group.label })
                          : $t('package.versions.expand_major', { major: group.label })
                      "
                      data-testid="major-group-expand-button"
                      @click="toggleMajorGroup(group.groupKey)"
                    >
                      <span
                        class="w-3 h-3 transition-transform duration-200 rtl-flip"
                        :class="
                          expandedMajorGroups.has(group.groupKey)
                            ? 'i-carbon:chevron-down'
                            : 'i-carbon:chevron-right'
                        "
                        aria-hidden="true"
                      />
                    </button>
                    <NuxtLink
                      v-if="group.versions[0]?.version"
                      :to="versionRoute(group.versions[0]?.version)"
                      class="block font-mono text-xs transition-colors duration-200 truncate inline-flex items-center gap-1"
                      :class="
                        group.versions[0]?.deprecated
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-fg-muted hover:text-fg'
                      "
                      :title="
                        group.versions[0]?.deprecated
                          ? $t('package.versions.deprecated_title', {
                              version: group.versions[0]?.version,
                            })
                          : group.versions[0]?.version
                      "
                    >
                      <span
                        v-if="group.versions[0]?.deprecated"
                        class="i-carbon-warning-hex w-3 h-3 shrink-0"
                        aria-hidden="true"
                      />
                      {{ group.versions[0]?.version }}
                    </NuxtLink>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 pe-2">
                    <DateTime
                      v-if="group.versions[0]?.time"
                      :datetime="group.versions[0]?.time"
                      class="text-[10px] text-fg-subtle"
                      year="numeric"
                      month="short"
                      day="numeric"
                    />
                    <ProvenanceBadge
                      v-if="group.versions[0]?.hasProvenance"
                      :package-name="packageName"
                      :version="group.versions[0]?.version"
                      compact
                    />
                  </div>
                </div>
                <div
                  v-if="group.versions[0]?.tags?.length"
                  class="flex items-center gap-1 ms-5 flex-wrap"
                >
                  <span
                    v-for="tag in group.versions[0].tags"
                    :key="tag"
                    class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
                    :title="tag"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <!-- Single version (no expand needed) -->
              <div v-else class="py-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="w-4 shrink-0" />
                    <NuxtLink
                      v-if="group.versions[0]?.version"
                      :to="versionRoute(group.versions[0]?.version)"
                      class="block font-mono text-xs transition-colors duration-200 truncate inline-flex items-center gap-1"
                      :class="
                        group.versions[0]?.deprecated
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-fg-muted hover:text-fg'
                      "
                      :title="
                        group.versions[0]?.deprecated
                          ? $t('package.versions.deprecated_title', {
                              version: group.versions[0]?.version,
                            })
                          : group.versions[0]?.version
                      "
                    >
                      <span
                        v-if="group.versions[0]?.deprecated"
                        class="i-carbon-warning-hex w-3 h-3 shrink-0"
                        aria-hidden="true"
                      />
                      {{ group.versions[0]?.version }}
                    </NuxtLink>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 pe-2">
                    <DateTime
                      v-if="group.versions[0]?.time"
                      :datetime="group.versions[0]?.time"
                      class="text-[10px] text-fg-subtle"
                      year="numeric"
                      month="short"
                      day="numeric"
                    />
                    <ProvenanceBadge
                      v-if="group.versions[0]?.hasProvenance"
                      :package-name="packageName"
                      :version="group.versions[0]?.version"
                      compact
                    />
                  </div>
                </div>
                <div v-if="group.versions[0]?.tags?.length" class="flex items-center gap-1 ms-5">
                  <span
                    v-for="tag in group.versions[0].tags"
                    :key="tag"
                    class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <!-- Version group versions -->
              <div
                v-if="expandedMajorGroups.has(group.groupKey) && group.versions.length > 1"
                class="ms-6 space-y-0.5"
              >
                <div v-for="v in group.versions.slice(1)" :key="v.version" class="py-1">
                  <div class="flex items-center justify-between gap-2">
                    <NuxtLink
                      :to="versionRoute(v.version)"
                      class="block font-mono text-xs transition-colors duration-200 truncate inline-flex items-center gap-1"
                      :class="
                        v.deprecated
                          ? 'text-red-400 hover:text-red-300'
                          : 'text-fg-subtle hover:text-fg-muted'
                      "
                      :title="
                        v.deprecated
                          ? $t('package.versions.deprecated_title', { version: v.version })
                          : v.version
                      "
                    >
                      <span
                        v-if="v.deprecated"
                        class="i-carbon-warning-hex w-3 h-3 shrink-0"
                        aria-hidden="true"
                      />
                      {{ v.version }}
                    </NuxtLink>
                    <div class="flex items-center gap-2 shrink-0 pe-2">
                      <DateTime
                        v-if="v.time"
                        :datetime="v.time"
                        class="text-[10px] text-fg-subtle"
                        year="numeric"
                        month="short"
                        day="numeric"
                      />
                      <ProvenanceBadge
                        v-if="v.hasProvenance"
                        :package-name="packageName"
                        :version="v.version"
                        compact
                      />
                    </div>
                  </div>
                  <div v-if="v.tags?.length" class="flex items-center gap-1 mt-0.5">
                    <span
                      v-for="tag in v.tags"
                      :key="tag"
                      class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div
            v-else-if="hasLoadedAll && hiddenTagRows.length === 0"
            class="py-1 text-xs text-fg-subtle"
          >
            {{ $t('package.versions.all_covered') }}
          </div>
        </div>
      </div>
    </div>
  </CollapsibleSection>
</template>
