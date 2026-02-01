<script setup lang="ts">
import type { PackageVersionInfo } from '#shared/types'
import { onClickOutside } from '@vueuse/core'
import { compare } from 'semver'
import {
  buildVersionToTagsMap,
  getPrereleaseChannel,
  getVersionGroupKey,
  getVersionGroupLabel,
  isSameVersionGroup,
} from '~/utils/versions'
import { fetchAllPackageVersions } from '~/composables/useNpmRegistry'

const props = defineProps<{
  packageName: string
  currentVersion: string
  versions: Record<string, unknown>
  distTags: Record<string, string>
  /** URL pattern for navigation. Use {version} as placeholder. */
  urlPattern: string
}>()

const isOpen = shallowRef(false)
const dropdownRef = useTemplateRef('dropdownRef')
const listboxRef = useTemplateRef('listboxRef')
const focusedIndex = shallowRef(-1)

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

// ============================================================================
// Version Display Types
// ============================================================================

interface VersionDisplay {
  version: string
  tags?: string[]
  isCurrent?: boolean
}

interface VersionGroup {
  id: string
  label: string
  primaryVersion: VersionDisplay
  versions: VersionDisplay[]
  isExpanded: boolean
  isLoading: boolean
}

// ============================================================================
// State
// ============================================================================

/** All version groups (dist-tags + major versions) */
const versionGroups = ref<VersionGroup[]>([])

/** Whether we've loaded all versions from the API */
const hasLoadedAll = shallowRef(false)

/** Loading state for initial all-versions fetch */
const isLoadingAll = shallowRef(false)

/** Cached full version list */
const allVersionsCache = shallowRef<PackageVersionInfo[] | null>(null)

// ============================================================================
// Computed
// ============================================================================

const latestVersion = computed(() => props.distTags.latest)

const versionToTags = computed(() => buildVersionToTagsMap(props.distTags))

/** Get URL for a specific version */
function getVersionUrl(version: string): string {
  return props.urlPattern.replace('{version}', version)
}

/** Safe semver comparison with fallback */
function safeCompareVersions(a: string, b: string): number {
  try {
    return compare(a, b)
  } catch {
    return a.localeCompare(b)
  }
}

// ============================================================================
// Initial Groups (SSR-safe, from props only)
// ============================================================================

/** Build initial version groups from dist-tags only */
function buildInitialGroups(): VersionGroup[] {
  const groups: VersionGroup[] = []
  const seenVersions = new Set<string>()

  // Group tags by version (multiple tags can point to same version)
  const versionMap = new Map<string, { tags: string[] }>()
  for (const [tag, version] of Object.entries(props.distTags)) {
    const existing = versionMap.get(version)
    if (existing) {
      existing.tags.push(tag)
    } else {
      versionMap.set(version, { tags: [tag] })
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

  // Build groups from tagged versions, sorted by version descending
  const sortedEntries = Array.from(versionMap.entries()).sort((a, b) =>
    safeCompareVersions(b[0], a[0]),
  )

  for (const [version, { tags }] of sortedEntries) {
    seenVersions.add(version)
    const primaryTag = tags[0]!

    groups.push({
      id: `tag:${primaryTag}`,
      label: primaryTag,
      primaryVersion: {
        version,
        tags,
        isCurrent: version === props.currentVersion,
      },
      versions: [], // Will be populated when expanded
      isExpanded: false,
      isLoading: false,
    })
  }

  return groups
}

// Initialize groups
versionGroups.value = buildInitialGroups()

// ============================================================================
// Load All Versions
// ============================================================================

async function loadAllVersions(): Promise<PackageVersionInfo[]> {
  if (allVersionsCache.value) return allVersionsCache.value

  isLoadingAll.value = true
  try {
    const versions = await fetchAllPackageVersions(props.packageName)
    allVersionsCache.value = versions
    hasLoadedAll.value = true
    return versions
  } finally {
    isLoadingAll.value = false
  }
}

/** Process loaded versions and populate groups */
function processLoadedVersions(allVersions: PackageVersionInfo[]) {
  const groups: VersionGroup[] = []
  const claimedVersions = new Set<string>()

  // Process each dist-tag and find its channel versions
  for (const [tag, tagVersion] of Object.entries(props.distTags)) {
    // Skip if we already have a group for this version
    const existingGroup = groups.find(g => g.primaryVersion.version === tagVersion)
    if (existingGroup) {
      // Add tag to existing group
      if (!existingGroup.primaryVersion.tags?.includes(tag)) {
        existingGroup.primaryVersion.tags = [...(existingGroup.primaryVersion.tags ?? []), tag]
        existingGroup.primaryVersion.tags.sort((a, b) => {
          if (a === 'latest') return -1
          if (b === 'latest') return 1
          return a.localeCompare(b)
        })
        // Update label to primary tag
        existingGroup.label = existingGroup.primaryVersion.tags[0]!
        existingGroup.id = `tag:${existingGroup.label}`
      }
      continue
    }

    const tagChannel = getPrereleaseChannel(tagVersion)

    // Find all versions in the same version group + prerelease channel
    // For 0.x versions, this means same major.minor; for 1.x+, same major
    const channelVersions = allVersions
      .filter(v => {
        const vChannel = getPrereleaseChannel(v.version)
        return isSameVersionGroup(v.version, tagVersion) && vChannel === tagChannel
      })
      .sort((a, b) => safeCompareVersions(b.version, a.version))
      .map(v => ({
        version: v.version,
        tags: versionToTags.value.get(v.version),
        isCurrent: v.version === props.currentVersion,
      }))

    // Mark these versions as claimed
    for (const v of channelVersions) {
      claimedVersions.add(v.version)
    }

    groups.push({
      id: `tag:${tag}`,
      label: tag,
      primaryVersion: {
        version: tagVersion,
        tags: versionToTags.value.get(tagVersion),
        isCurrent: tagVersion === props.currentVersion,
      },
      versions: channelVersions,
      isExpanded: false,
      isLoading: false,
    })
  }

  // Sort groups by primary version descending
  groups.sort((a, b) => safeCompareVersions(b.primaryVersion.version, a.primaryVersion.version))

  // Deduplicate groups with same version (merge their tags)
  const deduped: VersionGroup[] = []
  for (const group of groups) {
    const existing = deduped.find(g => g.primaryVersion.version === group.primaryVersion.version)
    if (existing) {
      // Merge tags
      const allTags = [
        ...(existing.primaryVersion.tags ?? []),
        ...(group.primaryVersion.tags ?? []),
      ]
      const uniqueTags = [...new Set(allTags)].sort((a, b) => {
        if (a === 'latest') return -1
        if (b === 'latest') return 1
        return a.localeCompare(b)
      })
      existing.primaryVersion.tags = uniqueTags
      existing.label = uniqueTags[0]!
      existing.id = `tag:${existing.label}`
    } else {
      deduped.push(group)
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
      tags: versionToTags.value.get(v.version),
      isCurrent: v.version === props.currentVersion,
    })
  }

  // Sort within each group and create groups
  // Sort group keys: "2", "1", "0.10", "0.9" (descending)
  const sortedGroupKeys = Array.from(byGroupKey.keys()).sort((a, b) => {
    // Parse as numbers for proper sorting
    const [aMajor, aMinor] = a.split('.').map(Number)
    const [bMajor, bMinor] = b.split('.').map(Number)
    if (aMajor !== bMajor) return (bMajor ?? 0) - (aMajor ?? 0)
    return (bMinor ?? -1) - (aMinor ?? -1)
  })

  for (const groupKey of sortedGroupKeys) {
    const versions = byGroupKey.get(groupKey)!
    versions.sort((a, b) => safeCompareVersions(b.version, a.version))

    const primaryVersion = versions[0]
    if (primaryVersion) {
      deduped.push({
        id: `group:${groupKey}`,
        label: getVersionGroupLabel(groupKey),
        primaryVersion,
        versions,
        isExpanded: false,
        isLoading: false,
      })
    }
  }

  versionGroups.value = deduped
}

// ============================================================================
// Expand/Collapse
// ============================================================================

async function toggleGroup(groupId: string) {
  const group = versionGroups.value.find(g => g.id === groupId)
  if (!group) return

  if (group.isExpanded) {
    group.isExpanded = false
    return
  }

  // Load all versions if not yet loaded
  if (!hasLoadedAll.value) {
    group.isLoading = true
    try {
      const allVersions = await loadAllVersions()
      processLoadedVersions(allVersions)
      // Find the group again after processing (it may have moved)
      const updatedGroup = versionGroups.value.find(g => g.id === groupId)
      if (updatedGroup) {
        updatedGroup.isExpanded = true
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load versions:', error)
    } finally {
      group.isLoading = false
    }
  } else {
    group.isExpanded = true
  }
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/** Flat list of navigable items for keyboard navigation */
const flatItems = computed(() => {
  const items: Array<{ type: 'group' | 'version'; groupId: string; version?: VersionDisplay }> = []

  for (const group of versionGroups.value) {
    items.push({ type: 'group', groupId: group.id, version: group.primaryVersion })

    if (group.isExpanded && group.versions.length > 1) {
      // Skip first version (it's the primary)
      for (const v of group.versions.slice(1)) {
        items.push({ type: 'version', groupId: group.id, version: v })
      }
    }
  }

  return items
})

function handleButtonKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  } else if (event.key === 'ArrowDown' && !isOpen.value) {
    event.preventDefault()
    isOpen.value = true
    focusedIndex.value = 0
  }
}

function handleListboxKeydown(event: KeyboardEvent) {
  const items = flatItems.value

  switch (event.key) {
    case 'Escape':
      isOpen.value = false
      break
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1)
      scrollToFocused()
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0)
      scrollToFocused()
      break
    case 'Home':
      event.preventDefault()
      focusedIndex.value = 0
      scrollToFocused()
      break
    case 'End':
      event.preventDefault()
      focusedIndex.value = items.length - 1
      scrollToFocused()
      break
    case 'ArrowRight': {
      event.preventDefault()
      const item = items[focusedIndex.value]
      if (item?.type === 'group') {
        const group = versionGroups.value.find(g => g.id === item.groupId)
        if (group && !group.isExpanded && group.versions.length > 1) {
          toggleGroup(item.groupId)
        }
      }
      break
    }
    case 'ArrowLeft': {
      event.preventDefault()
      const item = items[focusedIndex.value]
      if (item?.type === 'group') {
        const group = versionGroups.value.find(g => g.id === item.groupId)
        if (group?.isExpanded) {
          group.isExpanded = false
        }
      } else if (item?.type === 'version') {
        // Jump to parent group
        const groupIndex = items.findIndex(i => i.type === 'group' && i.groupId === item.groupId)
        if (groupIndex >= 0) {
          focusedIndex.value = groupIndex
          scrollToFocused()
        }
      }
      break
    }
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (focusedIndex.value >= 0 && focusedIndex.value < items.length) {
        const item = items[focusedIndex.value]
        if (item?.version) {
          navigateToVersion(item.version.version)
        }
      }
      break
  }
}

function scrollToFocused() {
  nextTick(() => {
    const focused = listboxRef.value?.querySelector('[data-focused="true"]')
    focused?.scrollIntoView({ block: 'nearest' })
  })
}

function navigateToVersion(version: string) {
  isOpen.value = false
  navigateTo(getVersionUrl(version))
}

// Reset focused index when dropdown opens
watch(isOpen, open => {
  if (open) {
    // Find current version in flat list
    const currentIdx = flatItems.value.findIndex(item => item.version?.isCurrent)
    focusedIndex.value = currentIdx >= 0 ? currentIdx : 0
  }
})

// Rebuild groups when props change
watch(
  () => [props.distTags, props.versions, props.currentVersion],
  () => {
    if (hasLoadedAll.value && allVersionsCache.value) {
      processLoadedVersions(allVersionsCache.value)
    } else {
      versionGroups.value = buildInitialGroups()
    }
  },
)
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      class="flex items-center gap-1.5 text-fg-subtle font-mono text-sm hover:text-fg transition-[color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
      @click="isOpen = !isOpen"
      @keydown="handleButtonKeydown"
    >
      <span>{{ currentVersion }}</span>
      <span
        v-if="currentVersion === latestVersion"
        class="text-xs px-1.5 py-0.5 rounded badge-green font-sans font-medium"
      >
        latest
      </span>
      <span
        class="i-carbon:chevron-down w-3.5 h-3.5 transition-[transform] duration-200 motion-reduce:transition-none"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-[opacity,transform] duration-100 ease-in motion-reduce:transition-none"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="listboxRef"
        role="listbox"
        tabindex="0"
        :aria-activedescendant="
          focusedIndex >= 0 ? `version-${flatItems[focusedIndex]?.version?.version}` : undefined
        "
        class="absolute top-full inset-is-0 mt-2 min-w-[220px] bg-bg-elevated border border-border rounded-lg shadow-lg z-50 py-1 max-h-[400px] overflow-y-auto overscroll-contain focus-visible:outline-none"
        @keydown="handleListboxKeydown"
      >
        <!-- Version groups -->
        <div v-for="group in versionGroups" :key="group.id">
          <!-- Group header (primary version) -->
          <div
            :id="`version-${group.primaryVersion.version}`"
            role="option"
            :aria-selected="group.primaryVersion.isCurrent"
            :data-focused="
              flatItems[focusedIndex]?.groupId === group.id &&
              flatItems[focusedIndex]?.type === 'group'
            "
            class="flex items-center gap-2 px-3 py-2 text-sm font-mono hover:bg-bg-muted transition-[color,background-color] focus-visible:outline-none cursor-pointer"
            :class="[
              group.primaryVersion.isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-muted',
              flatItems[focusedIndex]?.groupId === group.id &&
              flatItems[focusedIndex]?.type === 'group'
                ? 'bg-bg-muted'
                : '',
            ]"
          >
            <!-- Expand button -->
            <button
              v-if="group.versions.length > 1 || !hasLoadedAll"
              type="button"
              class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors shrink-0"
              :aria-expanded="group.isExpanded"
              :aria-label="group.isExpanded ? 'Collapse' : 'Expand'"
              @click.stop="toggleGroup(group.id)"
            >
              <span
                v-if="group.isLoading"
                class="i-carbon:rotate-180 w-3 h-3 motion-safe:animate-spin"
                aria-hidden="true"
              />
              <span
                v-else
                class="w-3 h-3 transition-transform duration-200 rtl-flip"
                :class="group.isExpanded ? 'i:carbon:chevron-down' : 'i-carbon:chevron-right'"
                aria-hidden="true"
              />
            </button>
            <span v-else class="w-4" />

            <!-- Version link -->
            <NuxtLink
              :to="getVersionUrl(group.primaryVersion.version)"
              class="flex-1 truncate hover:text-fg transition-colors"
              @click="isOpen = false"
            >
              {{ group.primaryVersion.version }}
            </NuxtLink>

            <!-- Tags -->
            <span v-if="group.primaryVersion.tags?.length" class="flex items-center gap-1 shrink-0">
              <span
                v-for="tag in group.primaryVersion.tags"
                :key="tag"
                class="text-xs px-1.5 py-0.5 rounded font-sans font-medium"
                :class="tag === 'latest' ? 'badge-green' : 'badge-subtle'"
              >
                {{ tag }}
              </span>
            </span>
          </div>

          <!-- Expanded versions -->
          <div
            v-if="group.isExpanded && group.versions.length > 1"
            class="ms-6 border-is border-border"
          >
            <template v-for="v in group.versions.slice(1)" :key="v.version">
              <NuxtLink
                :id="`version-${v.version}`"
                :to="getVersionUrl(v.version)"
                role="option"
                :aria-selected="v.isCurrent"
                :data-focused="
                  flatItems[focusedIndex]?.groupId === group.id &&
                  flatItems[focusedIndex]?.type === 'version' &&
                  flatItems[focusedIndex]?.version?.version === v.version
                "
                class="flex items-center justify-between gap-2 ps-4 pe-3 py-1.5 text-xs font-mono hover:bg-bg-muted transition-[color,background-color] focus-visible:outline-none"
                :class="[
                  v.isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-subtle',
                  flatItems[focusedIndex]?.version?.version === v.version ? 'bg-bg-muted' : '',
                ]"
                @click="isOpen = false"
              >
                <span class="truncate">{{ v.version }}</span>
                <span v-if="v.tags?.length" class="flex items-center gap-1 shrink-0">
                  <span
                    v-for="tag in v.tags"
                    :key="tag"
                    class="text-[9px] px-1 py-0.5 rounded font-sans font-medium"
                    :class="
                      tag === 'latest'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-bg-muted text-fg-subtle'
                    "
                  >
                    {{ tag }}
                  </span>
                </span>
              </NuxtLink>
            </template>
          </div>
        </div>

        <!-- Link to package page for full version list -->
        <div class="border-t border-border mt-1 pt-1 px-3 py-2">
          <NuxtLink
            :to="`/${packageName}`"
            class="text-xs text-fg-subtle hover:text-fg transition-[color] focus-visible:outline-none focus-visible:text-fg"
            @click="isOpen = false"
          >
            {{
              $t(
                'package.versions.view_all',
                { count: Object.keys(versions).length },
                Object.keys(versions).length,
              )
            }}
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>
