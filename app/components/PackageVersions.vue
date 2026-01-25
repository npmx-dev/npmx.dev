<script setup lang="ts">
import type { PackumentVersion, PackageVersionInfo } from '#shared/types'
import type { RouteLocationRaw } from 'vue-router'
import {
  buildVersionToTagsMap,
  compareVersions,
  filterExcludedTags,
  getPrereleaseChannel,
  parseVersion,
} from '~/utils/versions'
import { fetchAllPackageVersions } from '~/composables/useNpmRegistry'

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
      } as VersionDisplay,
    }))
    .sort((a, b) => compareVersions(b.primaryVersion.version, a.primaryVersion.version))
})

// Visible tag rows (limited to MAX_VISIBLE_TAGS)
const visibleTagRows = computed(() => allTagRows.value.slice(0, MAX_VISIBLE_TAGS))

// Hidden tag rows (overflow beyond MAX_VISIBLE_TAGS) - shown in "Other versions"
const hiddenTagRows = computed(() => allTagRows.value.slice(MAX_VISIBLE_TAGS))

// Client-side state for expansion and loaded versions
const expandedTags = ref<Set<string>>(new Set())
const tagVersions = ref<Map<string, VersionDisplay[]>>(new Map())
const loadingTags = ref<Set<string>>(new Set())

const otherVersionsExpanded = ref(false)
const otherMajorGroups = ref<
  Array<{ major: number; versions: VersionDisplay[]; expanded: boolean }>
>([])
const otherVersionsLoading = ref(false)

// Cached full version list (local to component instance)
const allVersionsCache = ref<PackageVersionInfo[] | null>(null)
const loadingVersions = ref(false)
const hasLoadedAll = ref(false)

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

    const tagParsed = parseVersion(tagVersion)
    const tagChannel = getPrereleaseChannel(tagVersion)

    const channelVersions = allVersions
      .filter(v => {
        const vParsed = parseVersion(v.version)
        const vChannel = getPrereleaseChannel(v.version)
        return vParsed.major === tagParsed.major && vChannel === tagChannel
      })
      .sort((a, b) => compareVersions(b.version, a.version))
      .map(v => ({
        version: v.version,
        time: v.time,
        tags: versionToTags.value.get(v.version),
        hasProvenance: v.hasProvenance,
      }))

    tagVersions.value.set(row.tag, channelVersions)

    for (const v of channelVersions) {
      claimedVersions.add(v.version)
    }
  }

  // Group unclaimed versions by major
  const byMajor = new Map<number, VersionDisplay[]>()

  for (const v of allVersions) {
    if (claimedVersions.has(v.version)) continue

    const major = parseVersion(v.version).major
    if (!byMajor.has(major)) {
      byMajor.set(major, [])
    }
    byMajor.get(major)!.push({
      version: v.version,
      time: v.time,
      tags: versionToTags.value.get(v.version),
      hasProvenance: v.hasProvenance,
    })
  }

  // Sort within each major
  for (const versions of byMajor.values()) {
    versions.sort((a, b) => compareVersions(b.version, a.version))
  }

  // Build major groups sorted by major descending
  const sortedMajors = Array.from(byMajor.keys()).sort((a, b) => b - a)
  otherMajorGroups.value = sortedMajors.map(major => ({
    major,
    versions: byMajor.get(major)!,
    expanded: false,
  }))
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

// Toggle a major group
function toggleMajorGroup(index: number) {
  const group = otherMajorGroups.value[index]
  if (group) {
    group.expanded = !group.expanded
  }
}

// Get versions for a tag (from loaded data or empty)
function getTagVersions(tag: string): VersionDisplay[] {
  return tagVersions.value.get(tag) ?? []
}
</script>

<template>
  <section v-if="allTagRows.length > 0" aria-labelledby="versions-heading" class="overflow-hidden">
    <h2 id="versions-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
      Versions
    </h2>

    <div class="space-y-0.5 min-w-0">
      <!-- Dist-tag rows (limited to MAX_VISIBLE_TAGS) -->
      <div v-for="row in visibleTagRows" :key="row.id">
        <div class="flex items-center gap-2">
          <!-- Expand button (only if there are more versions to show) -->
          <button
            v-if="getTagVersions(row.tag).length > 1 || !hasLoadedAll"
            type="button"
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors"
            :aria-expanded="expandedTags.has(row.tag)"
            :aria-label="expandedTags.has(row.tag) ? `Collapse ${row.tag}` : `Expand ${row.tag}`"
            @click="expandTagRow(row.tag)"
          >
            <span v-if="loadingTags.has(row.tag)" class="i-carbon-rotate w-3 h-3 animate-spin" />
            <span
              v-else
              class="w-3 h-3 transition-transform duration-200"
              :class="
                expandedTags.has(row.tag) ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right'
              "
            />
          </button>
          <span v-else class="w-4" />

          <!-- Version info -->
          <div class="flex-1 py-1.5 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="versionRoute(row.primaryVersion.version)"
                class="font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 truncate"
                :title="row.primaryVersion.version"
              >
                {{ row.primaryVersion.version }}
              </NuxtLink>
              <div class="flex items-center gap-2 shrink-0">
                <NuxtTime
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
        </div>

        <!-- Expanded versions -->
        <div
          v-if="expandedTags.has(row.tag) && getTagVersions(row.tag).length > 1"
          class="ml-4 pl-2 border-l border-border space-y-0.5"
        >
          <div v-for="v in getTagVersions(row.tag).slice(1)" :key="v.version" class="py-1">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="versionRoute(v.version)"
                class="font-mono text-xs text-fg-subtle hover:text-fg-muted transition-colors duration-200 truncate"
                :title="v.version"
              >
                {{ v.version }}
              </NuxtLink>
              <div class="flex items-center gap-2 shrink-0">
                <NuxtTime
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
          class="flex items-center gap-2 text-left"
          :aria-expanded="otherVersionsExpanded"
          @click="expandOtherVersions"
        >
          <span
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors"
          >
            <span v-if="otherVersionsLoading" class="i-carbon-rotate w-3 h-3 animate-spin" />
            <span
              v-else
              class="w-3 h-3 transition-transform duration-200"
              :class="otherVersionsExpanded ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right'"
            />
          </span>
          <span class="text-xs text-fg-muted py-1.5">
            Other versions
            <span v-if="hiddenTagRows.length > 0" class="text-fg-subtle">
              ({{ hiddenTagRows.length }} more tagged)
            </span>
          </span>
        </button>

        <!-- Expanded other versions -->
        <div v-if="otherVersionsExpanded" class="ml-4 pl-2 border-l border-border space-y-0.5">
          <!-- Hidden tag rows (overflow from visible tags) -->
          <div v-for="row in hiddenTagRows" :key="row.id" class="py-1">
            <div class="flex items-center justify-between gap-2">
              <NuxtLink
                :to="versionRoute(row.primaryVersion.version)"
                class="font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 truncate"
                :title="row.primaryVersion.version"
              >
                {{ row.primaryVersion.version }}
              </NuxtLink>
              <div class="flex items-center gap-2 shrink-0">
                <NuxtTime
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

          <!-- Major version groups (untagged versions) -->
          <template v-if="otherMajorGroups.length > 0">
            <div v-for="(group, groupIndex) in otherMajorGroups" :key="group.major">
              <!-- Major group header -->
              <button
                v-if="group.versions.length > 1"
                type="button"
                class="w-full text-left py-1"
                :aria-expanded="group.expanded"
                :title="group.versions[0]?.version"
                @click="toggleMajorGroup(groupIndex)"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 transition-transform duration-200 text-fg-subtle"
                    :class="group.expanded ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right'"
                  />
                  <span class="font-mono text-xs text-fg-muted truncate">
                    {{ group.versions[0]?.version }}
                  </span>
                </div>
                <div
                  v-if="group.versions[0]?.tags?.length"
                  class="flex items-center gap-1 ml-5 flex-wrap"
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
              </button>
              <!-- Single version (no expand needed) -->
              <div v-else class="py-1">
                <div class="flex items-center gap-2">
                  <span class="w-3" />
                  <NuxtLink
                    v-if="group.versions[0]"
                    :to="versionRoute(group.versions[0].version)"
                    class="font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 truncate"
                    :title="group.versions[0].version"
                  >
                    {{ group.versions[0].version }}
                  </NuxtLink>
                </div>
                <div v-if="group.versions[0]?.tags?.length" class="flex items-center gap-1 ml-5">
                  <span
                    v-for="tag in group.versions[0].tags"
                    :key="tag"
                    class="text-[8px] font-semibold text-fg-subtle uppercase tracking-wide"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>

              <!-- Major group versions -->
              <div v-if="group.expanded && group.versions.length > 1" class="ml-5 space-y-0.5">
                <div v-for="v in group.versions.slice(1)" :key="v.version" class="py-1">
                  <div class="flex items-center justify-between gap-2">
                    <NuxtLink
                      :to="versionRoute(v.version)"
                      class="font-mono text-xs text-fg-subtle hover:text-fg-muted transition-colors duration-200 truncate"
                      :title="v.version"
                    >
                      {{ v.version }}
                    </NuxtLink>
                    <div class="flex items-center gap-2 shrink-0">
                      <NuxtTime
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
            All versions are covered by tags above
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
