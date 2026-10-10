<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { compare } from 'verkit'
import {
  buildVersionToTagsMap,
  getPrereleaseChannel,
  getVersionGroupKey,
  getVersionGroupLabel,
  isSameVersionGroup,
} from '~/utils/versions'
import { fetchAllPackageVersions } from '~/utils/npm/api'

const props = withDefaults(
  defineProps<{
    packageName: string
    currentVersion: string
    versions: Record<string, unknown>
    distTags: Record<string, string>
    /** URL pattern for navigation. Use {version} as placeholder. */
    urlPattern: string
    /** class for the position of the dropdown, default is inset-is-0 */
    positionClass?: string | null
  }>(),
  {
    positionClass: 'inset-is-0',
  },
)

const popoverRef = useTemplateRef<HTMLElement>('popoverRef')
const triggerRef = useTemplateRef<HTMLElement>('triggerRef')

// isOpen is kept only to animate the trigger chevron
const isOpen = shallowRef(false)

const uid = useId()
const popoverId = `${uid}-versions`

// Close popover on scroll so it doesn't float away from its anchor
useEventListener('scroll', () => popoverRef.value?.hidePopover(), true)

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

/** Whether non-tagged version groups are visible */
const showAllGroups = shallowRef(false)

// ============================================================================
// Computed
// ============================================================================

const latestVersion = computed(() => props.distTags.latest)

const versionToTags = computed(() => buildVersionToTagsMap(props.distTags))

const visibleVersionGroups = computed(() => {
  if (!hasLoadedAll.value || showAllGroups.value) {
    return versionGroups.value
  }

  return versionGroups.value.filter(group => group.primaryVersion.tags?.length)
})

const hasAdditionalGroups = computed(() =>
  versionGroups.value.some(group => !group.primaryVersion.tags?.length),
)

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

  if (group.isLoading) return

  if (hasLoadedAll.value) {
    if (hasNestedVersions(group)) {
      group.isExpanded = !group.isExpanded
      return
    }

    if (controlsAdditionalGroups(group)) {
      showAllGroups.value = !showAllGroups.value
    }

    return
  }

  group.isLoading = true
  try {
    const allVersions = await loadAllVersions()
    processLoadedVersions(allVersions)

    // Find the group again after processing (it may have moved)
    const updatedGroup = versionGroups.value.find(g => g.id === groupId)
    if (updatedGroup) {
      if (hasNestedVersions(updatedGroup)) {
        updatedGroup.isExpanded = true
      } else if (controlsAdditionalGroups(updatedGroup)) {
        showAllGroups.value = true
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load versions:', error)
  } finally {
    group.isLoading = false
  }
}

// ============================================================================
// Helpers (unchanged)
// ============================================================================

function hasNestedVersions(group: VersionGroup): boolean {
  return group.versions.length > 1
}

function controlsAdditionalGroups(group: VersionGroup): boolean {
  return (
    Boolean(group.primaryVersion.tags?.length) &&
    !hasNestedVersions(group) &&
    hasAdditionalGroups.value
  )
}

function isGroupOpen(group: VersionGroup): boolean {
  return group.isExpanded || (controlsAdditionalGroups(group) && showAllGroups.value)
}

function canToggleGroup(group: VersionGroup): boolean {
  return (
    group.isLoading ||
    hasNestedVersions(group) ||
    !hasLoadedAll.value ||
    controlsAdditionalGroups(group)
  )
}

// ============================================================================
// Popover & Focus Management
// ============================================================================

// min-w-[220px] from the template — used as the overflow threshold when the
// element is still display:none (offsetWidth would be 0 in beforetoggle).
const MIN_POPOVER_WIDTH = 220

/**
 * Position the popover below its trigger.
 *
 * `width` should be the popover's rendered width when known (resize handler),
 * or MIN_POPOVER_WIDTH when the element is still hidden (beforetoggle).
 * Left-aligns unless that width would overflow the right viewport edge.
 */
function positionPopover(width = MIN_POPOVER_WIDTH) {
  if (!triggerRef.value || !popoverRef.value) return
  const rect = triggerRef.value.getBoundingClientRect()
  const el = popoverRef.value

  el.style.top = `${rect.bottom + 8}px`

  if (rect.left + width > window.innerWidth) {
    el.style.left = 'auto'
    el.style.right = `${window.innerWidth - rect.right}px`
  } else {
    el.style.left = `${rect.left}px`
    el.style.right = 'auto'
  }
}

/**
 * Runs before the popover is shown — sets position before first paint and
 * before the CSS entry transition starts (no forced-reflow interference).
 */
function handlePopoverBeforeToggle(event: ToggleEvent) {
  if (event.newState === 'open') positionPopover()
}

// Reposition while the popover is open. The element is visible here so
// offsetWidth is accurate and reading it doesn't interfere with animation.
useEventListener('resize', () => {
  if (isOpen.value) positionPopover(popoverRef.value?.offsetWidth)
})

function handlePopoverToggle(event: ToggleEvent) {
  isOpen.value = event.newState === 'open'

  if (event.newState !== 'open') return

  // Move focus to the current version link, or the first interactive element
  nextTick(() => {
    const current = popoverRef.value?.querySelector<HTMLElement>('[aria-current="page"]')
    const first = popoverRef.value?.querySelector<HTMLElement>('a[href], button:not([disabled])')
    ;(current ?? first)?.focus()
  })
}

/** ArrowDown/Up navigate between visible interactive elements in the popover. */
function handlePopoverKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return

  event.preventDefault()

  const focusable = Array.from(
    popoverRef.value?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]):not([tabindex="-1"])',
    ) ?? [],
  )

  const current = document.activeElement as HTMLElement
  const idx = focusable.indexOf(current)

  let next: HTMLElement | undefined
  if (event.key === 'ArrowDown') next = focusable[idx + 1] ?? focusable[0]
  else if (event.key === 'ArrowUp') next = focusable[idx - 1] ?? focusable[focusable.length - 1]
  else if (event.key === 'Home') next = focusable[0]
  else next = focusable[focusable.length - 1]

  next?.focus()
  next?.scrollIntoView({ block: 'nearest' })
}

/** Open the popover with ArrowDown when focus is on the trigger. */
function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    popoverRef.value?.showPopover()
    // focus is managed by handlePopoverToggle via the toggle event
  }
}

// Rebuild groups when props change
watch(
  () => [props.distTags, props.versions, props.currentVersion],
  () => {
    showAllGroups.value = false
    if (hasLoadedAll.value && allVersionsCache.value) {
      processLoadedVersions(allVersionsCache.value)
    } else {
      versionGroups.value = buildInitialGroups()
    }
  },
)
</script>

<template>
  <!--
    Uses the native Popover API:
    - popovertarget wires the button to the popover declaratively
    - The browser provides aria-expanded, light-dismiss (click outside + Esc),
      and automatic focus-return to the trigger on close
    - We add focus-on-open and ArrowDown/Up navigation on top
  -->
  <nav :aria-label="$t('package.versions.nav_label')">
    <button
      ref="triggerRef"
      type="button"
      :popovertarget="popoverId"
      class="break-all text-start font-mono text-sm hover:text-accent transition-[color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded"
      data-testid="version-selector-button"
      @keydown="handleTriggerKeydown"
    >
      <span dir="ltr" class="me-1.5">{{ currentVersion }}</span>
      <span
        v-if="currentVersion === latestVersion"
        class="text-xs px-1.5 py-0.5 rounded badge-accent font-sans font-medium me-1.5"
      >
        latest
      </span>
      <span
        class="i-lucide:chevron-down w-3.5 h-3.5 transition-[transform] duration-200 motion-reduce:transition-none vertical-middle"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>

    <ul
      :id="popoverId"
      ref="popoverRef"
      popover="auto"
      :aria-label="$t('package.versions.selector_label')"
      class="version-selector-popover min-w-[220px] max-w-[calc(100vw-40px)] bg-bg-subtle/80 backdrop-blur-sm border border-border-subtle rounded-lg shadow-lg shadow-fg-subtle/10 py-1 max-h-[400px] overflow-y-auto overscroll-contain"
      @beforetoggle="handlePopoverBeforeToggle"
      @toggle="handlePopoverToggle"
      @keydown="handlePopoverKeydown"
    >
      <!-- Version groups -->
      <li v-for="group in visibleVersionGroups" :key="group.id">
        <div
          class="flex items-center gap-2 px-3 py-2 text-sm font-mono transition-[color,background-color]"
          :class="group.primaryVersion.isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-muted'"
        >
          <!-- Expand toggle: proper button with label, controls the sub-version list -->
          <button
            v-if="canToggleGroup(group)"
            type="button"
            class="w-4 h-4 flex items-center justify-center text-fg-subtle hover:text-fg transition-colors shrink-0"
            :aria-expanded="isGroupOpen(group)"
            :aria-controls="`${popoverId}-sub-${group.id}`"
            :aria-label="
              isGroupOpen(group)
                ? $t('package.versions.collapse', { tag: group.label })
                : $t('package.versions.expand', { tag: group.label })
            "
            @click="toggleGroup(group.id)"
          >
            <span
              v-if="group.isLoading"
              class="i-svg-spinners:ring-resize w-3 h-3"
              aria-hidden="true"
            />
            <span
              v-else
              class="w-3 h-3 transition-transform duration-200 rtl-flip"
              :class="isGroupOpen(group) ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'"
              aria-hidden="true"
            />
          </button>
          <span v-else class="w-4 h-4 shrink-0" />

          <!-- Version link -->
          <NuxtLink
            :id="`${popoverId}-${group.primaryVersion.version}`"
            :to="getVersionUrl(group.primaryVersion.version)"
            :aria-current="group.primaryVersion.isCurrent ? 'page' : undefined"
            class="flex-1 truncate hover:text-fg transition-colors"
            @click="popoverRef?.hidePopover()"
          >
            <span dir="ltr">{{ group.primaryVersion.version }}</span>
          </NuxtLink>

          <!-- Tags -->
          <span v-if="group.primaryVersion.tags?.length" class="flex items-center gap-1 shrink-0">
            <span
              v-for="tag in group.primaryVersion.tags"
              :key="tag"
              class="text-xs px-1.5 py-0.5 rounded font-sans font-medium"
              :class="tag === 'latest' ? 'badge-accent' : 'badge-subtle'"
            >
              {{ tag }}
            </span>
          </span>
        </div>

        <!-- Sub-versions, controlled by the expand button above -->
        <ol
          v-if="group.isExpanded && group.versions.length > 1"
          :id="`${popoverId}-sub-${group.id}`"
          reversed
          class="ms-6 border-is border-border"
        >
          <li v-for="v in group.versions.slice(1)" :key="v.version">
            <NuxtLink
              :id="`${popoverId}-${v.version}`"
              :to="getVersionUrl(v.version)"
              :aria-current="v.isCurrent ? 'page' : undefined"
              class="flex items-center justify-between gap-2 ps-4 pe-3 py-1.5 text-xs font-mono hover:bg-bg-muted transition-[color,background-color] focus-visible:outline-none"
              :class="v.isCurrent ? 'text-fg bg-bg-muted' : 'text-fg-subtle'"
              @click="popoverRef?.hidePopover()"
            >
              <span class="truncate" dir="ltr">{{ v.version }}</span>
              <span v-if="v.tags?.length" class="flex items-center gap-1 shrink-0">
                <span
                  v-for="tag in v.tags"
                  :key="tag"
                  class="text-4xs px-1 py-0.5 rounded font-sans font-medium"
                  :class="tag === 'latest' ? 'badge-accent' : 'badge-subtle'"
                >
                  {{ tag }}
                </span>
              </span>
            </NuxtLink>
          </li>
        </ol>
      </li>

      <!-- Link to package page for full version list -->
      <li class="border-t border-border mt-1 pt-1 px-3 py-2">
        <NuxtLink
          :to="packageVersionsRoute(packageName)"
          class="text-xs text-fg-subtle hover:text-fg transition-[color] focus-visible:outline-none focus-visible:text-fg"
          @click="popoverRef?.hidePopover()"
        >
          {{
            $t(
              'package.versions.view_all',
              { count: Object.keys(versions).length },
              Object.keys(versions).length,
            )
          }}
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
/*
  Popover positioning: reset the UA default (centered in viewport) and animate.
  The JS positionPopover() sets top/left at open-time.
  @starting-style provides the "from" frame for the entry transition.
*/
.version-selector-popover {
  position: fixed;
  margin: 0;
  inset: auto;

  opacity: 0;
  transform: scale(0.95);
  transform-origin: top left;

  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out,
    display 0.15s allow-discrete,
    overlay 0.15s allow-discrete;
}

.version-selector-popover:popover-open {
  opacity: 1;
  transform: scale(1);
}

@starting-style {
  .version-selector-popover:popover-open {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
