<script setup lang="ts">
import type { PackageVersionInfo, SlimVersion } from '#shared/types'
import { compare } from 'semver'
import type { RouteLocationRaw } from 'vue-router'
import { fetchAllPackageVersions } from '~/utils/npm/api'
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
  versions: Record<string, SlimVersion>
  distTags: Record<string, string>
  time: Record<string, string>
  selectedVersion?: string
}>()

const chartModal = useModal('chart-modal')
const hasDistributionModalTransitioned = shallowRef(false)
const isDistributionModalOpen = shallowRef(false)
let distributionModalFallbackTimer: ReturnType<typeof setTimeout> | null = null

function clearDistributionModalFallbackTimer() {
  if (distributionModalFallbackTimer) {
    clearTimeout(distributionModalFallbackTimer)
    distributionModalFallbackTimer = null
  }
}

async function openDistributionModal() {
  isDistributionModalOpen.value = true
  hasDistributionModalTransitioned.value = false
  // ensure the component renders before opening the dialog
  await nextTick()
  chartModal.open()

  // Fallback: Force mount if transition event doesn't fire
  clearDistributionModalFallbackTimer()
  distributionModalFallbackTimer = setTimeout(() => {
    if (!hasDistributionModalTransitioned.value) {
      hasDistributionModalTransitioned.value = true
    }
  }, 500)
}

function closeDistributionModal() {
  isDistributionModalOpen.value = false
  hasDistributionModalTransitioned.value = false
  clearDistributionModalFallbackTimer()
}

function handleDistributionModalTransitioned() {
  hasDistributionModalTransitioned.value = true
  clearDistributionModalFallbackTimer()
}

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

// Build route object for package version link
function versionRoute(version: string): RouteLocationRaw {
  return packageRoute(props.packageName, version)
}

// Version to tags lookup (supports multiple tags per version)
const versionToTags = computed(() => buildVersionToTagsMap(props.distTags))

const effectiveCurrentVersion = computed(
  () => props.selectedVersion ?? props.distTags.latest ?? undefined,
)

// All tag rows derived from props (SSR-safe)
// Deduplicates so each version appears only once, with all its tags
const allTagRows = computed(() => {
  // Group tags by version with their metadata
  const versionMap = new Map<string, { tags: string[]; versionData: SlimVersion | undefined }>()
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
        hasProvenance: versionData?.hasProvenance,
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

function findClaimingTag(version: string): string | null {
  const versionChannel = getPrereleaseChannel(version)

  // First matching tag claims the version
  for (const row of allTagRows.value) {
    const tagVersion = props.distTags[row.tag]
    if (!tagVersion) continue

    const tagChannel = getPrereleaseChannel(tagVersion)

    if (isSameVersionGroup(version, tagVersion) && versionChannel === tagChannel) {
      return row.tag
    }
  }

  return null
}

// Whether this row should be highlighted for the current version
function rowContainsCurrentVersion(row: (typeof visibleTagRows.value)[0]): boolean {
  if (!effectiveCurrentVersion.value) return false

  if (row.primaryVersion.version === effectiveCurrentVersion.value) return true

  if (getTagVersions(row.tag).some(v => v.version === effectiveCurrentVersion.value)) return true

  const claimingTag = findClaimingTag(effectiveCurrentVersion.value)
  return claimingTag === row.tag
}

function otherVersionsContainsCurrent(): boolean {
  if (!effectiveCurrentVersion.value) return false

  const claimingTag = findClaimingTag(effectiveCurrentVersion.value)

  // If a tag claims it, check if that tag is in visibleTagRows
  if (claimingTag) {
    const isInVisibleTags = visibleTagRows.value.some(row => row.tag === claimingTag)
    if (!isInVisibleTags) return true
    return false
  }

  // No tag claims it - it would be in otherMajorGroups
  return true
}

function hiddenRowContainsCurrent(row: (typeof hiddenTagRows.value)[0]): boolean {
  if (!effectiveCurrentVersion.value) return false
  if (row.primaryVersion.version === effectiveCurrentVersion.value) return true

  const claimingTag = findClaimingTag(effectiveCurrentVersion.value)
  return claimingTag === row.tag
}

function majorGroupContainsCurrent(group: (typeof otherMajorGroups.value)[0]): boolean {
  if (!effectiveCurrentVersion.value) return false
  return group.versions.some(v => v.version === effectiveCurrentVersion.value)
}
</script>

<template>
  <CollapsibleSection
    v-if="allTagRows.length > 0"
    :title="$t('package.versions.title')"
    id="versions"
  >
    <template #actions>
      <ButtonBase
        variant="secondary"
        class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 rounded"
        :title="$t('package.downloads.community_distribution')"
        classicon="i-carbon:load-balancer-network"
        @click="openDistributionModal"
      >
        <span class="sr-only">{{ $t('package.downloads.community_distribution') }}</span>
      </ButtonBase>
    </template>
    <div class="space-y-0.5 min-w-0">
      <!-- Dist-tag rows (limited to MAX_VISIBLE_TAGS) -->
      <div v-for="row in visibleTagRows" :key="row.id">
        <div
          class="flex items-center gap-2 pe-2 px-1"
          :class="rowContainsCurrentVersion(row) ? 'bg-bg-subtle rounded-lg' : ''"
        >
          <!-- Expand button (only if there are more versions to show) -->
          <button
            v-if="getTagVersions(row.tag).length > 1 || !hasLoadedAll"
            type="button"
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors rounded-sm"
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
              <LinkBase
                :to="versionRoute(row.primaryVersion.version)"
                block
                class="text-sm"
                :class="
                  row.primaryVersion.deprecated
                    ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    : undefined
                "
                :title="
                  row.primaryVersion.deprecated
                    ? $t('package.versions.deprecated_title', {
                        version: row.primaryVersion.version,
                      })
                    : row.primaryVersion.version
                "
                :classicon="row.primaryVersion.deprecated ? 'i-carbon-warning-hex' : undefined"
              >
                <span dir="ltr" class="block truncate">
                  {{ row.primaryVersion.version }}
                </span>
              </LinkBase>
              <div v-if="row.tags.length" class="flex items-center gap-1 mt-0.5 flex-wrap">
                <span
                  v-for="tag in row.tags"
                  :key="tag"
                  class="text-4xs font-semibold text-fg-subtle uppercase tracking-wide truncate"
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
          <div
            v-for="v in getTagVersions(row.tag).slice(1)"
            :key="v.version"
            class="py-1"
            :class="v.version === effectiveCurrentVersion ? 'rounded bg-bg-subtle px-2 -mx-2' : ''"
          >
            <div class="flex items-center justify-between gap-2">
              <LinkBase
                :to="versionRoute(v.version)"
                block
                class="text-xs"
                :class="
                  v.deprecated
                    ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    : undefined
                "
                :title="
                  v.deprecated
                    ? $t('package.versions.deprecated_title', { version: v.version })
                    : v.version
                "
                :classicon="v.deprecated ? 'i-carbon-warning-hex' : undefined"
              >
                <span dir="ltr" class="block truncate">
                  {{ v.version }}
                </span>
              </LinkBase>
              <div class="flex items-center gap-2 shrink-0">
                <DateTime
                  v-if="v.time"
                  :datetime="v.time"
                  class="text-3xs text-fg-subtle"
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
                class="text-5xs font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
                :title="tag"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Other versions section -->
      <div class="p-1">
        <button
          type="button"
          class="flex items-center gap-2 text-start rounded-sm w-full"
          :class="otherVersionsContainsCurrent() ? 'bg-bg-subtle' : ''"
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
          <div
            v-for="row in hiddenTagRows"
            :key="row.id"
            class="py-1"
            :class="hiddenRowContainsCurrent(row) ? 'rounded bg-bg-subtle px-2 -mx-2' : ''"
          >
            <div class="flex items-center justify-between gap-2">
              <LinkBase
                :to="versionRoute(row.primaryVersion.version)"
                block
                class="text-xs"
                :class="
                  row.primaryVersion.deprecated
                    ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                    : undefined
                "
                :title="
                  row.primaryVersion.deprecated
                    ? $t('package.versions.deprecated_title', {
                        version: row.primaryVersion.version,
                      })
                    : row.primaryVersion.version
                "
                :classicon="row.primaryVersion.deprecated ? 'i-carbon-warning-hex' : undefined"
              >
                <span dir="ltr" class="block truncate">
                  {{ row.primaryVersion.version }}
                </span>
              </LinkBase>
              <div class="flex items-center gap-2 shrink-0 pe-2">
                <DateTime
                  v-if="row.primaryVersion.time"
                  :datetime="row.primaryVersion.time"
                  class="text-3xs text-fg-subtle"
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
                class="text-5xs font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
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
              <div
                v-if="group.versions.length > 1"
                class="py-1"
                :class="majorGroupContainsCurrent(group) ? 'rounded bg-bg-subtle px-2 -mx-2' : ''"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors shrink-0 rounded-sm"
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
                    <LinkBase
                      v-if="group.versions[0]?.version"
                      :to="versionRoute(group.versions[0]?.version)"
                      block
                      class="text-xs"
                      :class="
                        group.versions[0]?.deprecated
                          ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                          : undefined
                      "
                      :title="
                        group.versions[0]?.deprecated
                          ? $t('package.versions.deprecated_title', {
                              version: group.versions[0]?.version,
                            })
                          : group.versions[0]?.version
                      "
                      :classicon="
                        group.versions[0]?.deprecated ? 'i-carbon-warning-hex' : undefined
                      "
                    >
                      <span dir="ltr" class="block truncate">
                        {{ group.versions[0]?.version }}
                      </span>
                    </LinkBase>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 pe-2">
                    <DateTime
                      v-if="group.versions[0]?.time"
                      :datetime="group.versions[0]?.time"
                      class="text-3xs text-fg-subtle"
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
                    class="text-5xs font-semibold text-fg-subtle uppercase tracking-wide truncate max-w-[120px]"
                    :title="tag"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
              <!-- Single version (no expand needed) -->
              <div
                v-else
                class="py-1"
                :class="majorGroupContainsCurrent(group) ? 'rounded bg-bg-subtle px-2 -mx-2' : ''"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0">
                    <LinkBase
                      v-if="group.versions[0]?.version"
                      :to="versionRoute(group.versions[0]?.version)"
                      block
                      class="text-xs ms-6"
                      :class="
                        group.versions[0]?.deprecated
                          ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                          : undefined
                      "
                      :title="
                        group.versions[0]?.deprecated
                          ? $t('package.versions.deprecated_title', {
                              version: group.versions[0]?.version,
                            })
                          : group.versions[0]?.version
                      "
                      :classicon="
                        group.versions[0]?.deprecated ? 'i-carbon-warning-hex' : undefined
                      "
                    >
                      <span dir="ltr" class="block truncate">
                        {{ group.versions[0]?.version }}
                      </span>
                    </LinkBase>
                  </div>
                  <div class="flex items-center gap-2 shrink-0 pe-2">
                    <DateTime
                      v-if="group.versions[0]?.time"
                      :datetime="group.versions[0]?.time"
                      class="text-3xs text-fg-subtle"
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
                    class="text-5xs font-semibold text-fg-subtle uppercase tracking-wide"
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
                <div
                  v-for="v in group.versions.slice(1)"
                  :key="v.version"
                  class="py-1"
                  :class="
                    v.version === effectiveCurrentVersion ? 'rounded bg-bg-subtle px-2 -mx-2' : ''
                  "
                >
                  <div class="flex items-center justify-between gap-2">
                    <LinkBase
                      :to="versionRoute(v.version)"
                      block
                      class="text-xs"
                      :class="
                        v.deprecated
                          ? 'text-red-800 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300'
                          : undefined
                      "
                      :title="
                        v.deprecated
                          ? $t('package.versions.deprecated_title', { version: v.version })
                          : v.version
                      "
                      :classicon="v.deprecated ? 'i-carbon-warning-hex' : undefined"
                    >
                      <span dir="ltr" class="block truncate">
                        {{ v.version }}
                      </span>
                    </LinkBase>
                    <div class="flex items-center gap-2 shrink-0 pe-2">
                      <DateTime
                        v-if="v.time"
                        :datetime="v.time"
                        class="text-3xs text-fg-subtle"
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
                      class="text-5xs font-semibold text-fg-subtle uppercase tracking-wide"
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

  <!-- Version Distribution Modal -->
  <PackageChartModal
    v-if="isDistributionModalOpen"
    :title="$t('package.versions.distribution_modal_title')"
    @close="closeDistributionModal"
    @transitioned="handleDistributionModalTransitioned"
  >
    <!-- The Chart is mounted after the dialog has transitioned -->
    <!-- This avoids flaky behavior and ensures proper modal lifecycle -->
    <Transition name="opacity" mode="out-in">
      <PackageVersionDistribution
        v-if="hasDistributionModalTransitioned"
        :package-name="packageName"
        :in-modal="true"
      />
    </Transition>

    <!-- This placeholder bears the same dimensions as the VersionDistribution component -->
    <!-- Avoids CLS when the dialog has transitioned -->
    <div
      v-if="!hasDistributionModalTransitioned"
      class="w-full aspect-[272/609] sm:aspect-[718/571]"
    />
  </PackageChartModal>
</template>

<style scoped>
.opacity-enter-active,
.opacity-leave-active {
  transition: opacity 200ms ease;
}

.opacity-enter-from,
.opacity-leave-to {
  opacity: 0;
}
</style>
