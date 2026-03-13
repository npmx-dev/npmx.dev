<script setup lang="ts">
import {
  buildVersionToTagsMap,
  buildTaggedVersionRows,
  getVersionGroupKey,
  getVersionGroupLabel,
} from '~/utils/versions'

definePageMeta({
  name: 'package-versions',
})

const route = useRoute()
const router = useRouter()

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

// ─── Data ─────────────────────────────────────────────────────────────────────

const { data: versionHistoryData } = usePackageVersionHistory(packageName)

// TODO: Replace mockChangelogs with pre-rendered HTML from the server
//       (GitHub releases body or CHANGELOG.md, parsed server-side like README)
const mockChangelogs: Record<string, string> = {}

// ─── Derived data ─────────────────────────────────────────────────────────────

const distTags = computed(() => versionHistoryData.value?.distTags ?? {})
const versionHistory = computed(() => versionHistoryData.value?.versions ?? [])

const versionToTagsMap = computed(() => buildVersionToTagsMap(distTags.value))

const sortedVersions = computed(() =>
  versionHistory.value.map(v => ({
    ...v,
    tags: versionToTagsMap.value.get(v.version),
    hasChangelog: v.version in mockChangelogs,
  })),
)

const tagRows = computed(() => buildTaggedVersionRows(distTags.value))

const versionByKey = computed(() => new Map(versionHistory.value.map(v => [v.version, v])))

function getVersionTime(version: string): string | undefined {
  return versionByKey.value.get(version)?.time
}

// ─── Version groups ───────────────────────────────────────────────────────────

const expandedGroups = ref(new Set<string>())

const versionGroups = computed(() => {
  const byKey = new Map<string, typeof sortedVersions.value>()
  for (const v of sortedVersions.value) {
    const key = getVersionGroupKey(v.version)
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

function toggleGroup(groupKey: string) {
  if (expandedGroups.value.has(groupKey)) {
    expandedGroups.value.delete(groupKey)
  } else {
    expandedGroups.value.add(groupKey)
  }
}

// ─── Changelog side panel ─────────────────────────────────────────────────────

const selectedChangelogVersion = ref<string | null>(null)

const selectedChangelogContent = computed(() => {
  if (!selectedChangelogVersion.value) return ''
  return mockChangelogs[selectedChangelogVersion.value] ?? ''
})

// function toggleChangelog(version: string) {
//   selectedChangelogVersion.value = selectedChangelogVersion.value === version ? null : version
// }

// ─── Jump to version ──────────────────────────────────────────────────────────

const jumpVersion = ref('')
const jumpError = ref('')

function navigateToVersion() {
  const v = jumpVersion.value.trim()
  if (!v) return
  if (!versionHistory.value.some(entry => entry.version === v)) {
    jumpError.value = `"${v}" not found`
    return
  }
  jumpError.value = ''
  router.push(packageRoute(packageName.value, v))
}

watch(jumpVersion, () => {
  jumpError.value = ''
})
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
        <div class="flex flex-col items-end gap-1 shrink-0">
          <div class="flex items-center gap-2">
            <InputBase
              v-model="jumpVersion"
              type="text"
              placeholder="Jump to version…"
              aria-label="Jump to version"
              size="small"
              class="w-36 sm:w-44 font-mono"
              @keydown.enter="navigateToVersion"
            />
            <ButtonBase
              variant="secondary"
              size="small"
              classicon="i-lucide:arrow-right"
              :disabled="!jumpVersion.trim()"
              @click="navigateToVersion"
            >
              Go
            </ButtonBase>
          </div>
          <p
            v-if="jumpError"
            role="alert"
            class="text-red-500 dark:text-red-400 text-xs leading-none"
          >
            {{ jumpError }}
          </p>
        </div>
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
              v-if="versionByKey.get(tagRows[0].version)?.hasProvenance"
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
              v-if="versionByKey.get(row.version)?.hasProvenance"
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
      <section>
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 px-4 sm:px-6 ps-1">
          Version History
          <span class="ms-1 normal-case font-normal tracking-normal">
            ({{ sortedVersions.length }})
          </span>
        </h2>

        <!-- List + changelog side panel -->
        <div class="flex">
          <!-- Version list (grouped by major) -->
          <div
            class="flex-1 min-w-0 border-y sm:border border-border sm:rounded-lg sm:overflow-hidden"
          >
            <div
              v-for="group in versionGroups"
              :key="group.groupKey"
              class="border-b border-border last:border-0"
            >
              <!-- Group header -->
              <button
                type="button"
                class="flex items-center gap-3 px-4 py-2.5 w-full text-start hover:bg-bg-subtle transition-colors"
                :aria-expanded="expandedGroups.has(group.groupKey)"
                :aria-label="`${expandedGroups.has(group.groupKey) ? 'Collapse' : 'Expand'} ${group.label}`"
                @click="toggleGroup(group.groupKey)"
              >
                <span class="w-4 h-4 flex items-center justify-center text-fg-subtle shrink-0">
                  <span
                    class="i-lucide:chevron-right w-3 h-3 transition-transform duration-200 rtl-flip"
                    :class="expandedGroups.has(group.groupKey) ? 'rotate-90' : ''"
                    aria-hidden="true"
                  />
                </span>
                <span class="font-mono text-sm font-medium">{{ group.label }}</span>
                <span class="text-xs text-fg-subtle">({{ group.versions.length }})</span>
                <span class="ms-auto flex items-center gap-3 shrink-0">
                  <span class="font-mono text-xs text-fg-muted" dir="ltr">{{
                    group.versions[0]?.version
                  }}</span>
                  <DateTime
                    v-if="group.versions[0]?.time"
                    :datetime="group.versions[0].time"
                    class="text-xs text-fg-subtle hidden sm:block"
                    year="numeric"
                    month="short"
                    day="numeric"
                  />
                </span>
              </button>

              <!-- Expanded versions -->
              <div v-show="expandedGroups.has(group.groupKey)" class="border-t border-border">
                <div
                  v-for="v in group.versions"
                  :key="v.version"
                  class="border-b border-border last:border-0 transition-colors"
                  :class="selectedChangelogVersion === v.version ? 'bg-bg-subtle' : ''"
                >
                  <div
                    class="flex items-center gap-3 px-4 ps-11 py-2.5 group relative"
                    :class="selectedChangelogVersion === v.version ? '' : 'hover:bg-bg-subtle'"
                  >
                    <!-- Version + badges -->
                    <div class="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                      <LinkBase
                        :to="packageRoute(packageName, v.version)"
                        class="font-mono text-sm after:absolute after:inset-0 after:content-['']"
                        :class="v.deprecated ? 'text-red-700 dark:text-red-400' : ''"
                        :classicon="v.deprecated ? 'i-lucide:octagon-alert' : undefined"
                        dir="ltr"
                      >
                        {{ v.version }}
                      </LinkBase>
                      <div
                        v-if="v.tags?.length"
                        class="flex items-center gap-1 flex-wrap relative z-10"
                      >
                        <span
                          v-for="tag in v.tags"
                          :key="tag"
                          class="text-4xs font-semibold uppercase tracking-wide"
                          :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
                        >
                          {{ tag }}
                        </span>
                      </div>
                      <span
                        v-if="v.deprecated"
                        class="text-3xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded relative z-10"
                        :title="v.deprecated"
                      >
                        deprecated
                      </span>
                    </div>

                    <!-- Right side -->
                    <div class="flex items-center gap-2 shrink-0 relative z-10">
                      <!-- TODO(atriiy): changelog would be implemented later -->

                      <!-- Divider -->
                      <span
                        v-if="v.hasChangelog"
                        class="w-px h-3.5 bg-border shrink-0 hidden sm:block"
                        aria-hidden="true"
                      />

                      <!-- Metadata: date + provenance -->
                      <DateTime
                        v-if="v.time"
                        :datetime="v.time"
                        class="text-xs text-fg-subtle hidden sm:block"
                        year="numeric"
                        month="short"
                        day="numeric"
                      />
                      <ProvenanceBadge
                        v-if="v.hasProvenance"
                        :package-name="packageName"
                        :version="v.version"
                        compact
                        :linked="false"
                      />
                    </div>
                  </div>

                  <!-- Mobile inline changelog (below the row, sm and up uses side panel) -->
                  <div
                    v-if="v.hasChangelog"
                    class="grid sm:hidden transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
                    :class="
                      selectedChangelogVersion === v.version ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    "
                  >
                    <div class="overflow-hidden">
                      <div class="changelog-body border-t border-border px-4 py-3 text-sm">
                        {{ selectedChangelogVersion === v.version ? selectedChangelogContent : '' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
