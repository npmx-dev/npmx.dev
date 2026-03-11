<script setup lang="ts">
import type { PackageVersionInfo } from '#shared/types'
import { compare } from 'semver'
import { buildVersionToTagsMap, buildTaggedVersionRows } from '~/utils/versions'

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

// ─── Mock data ────────────────────────────────────────────────────────────────
// TODO: Replace distTags with pkg['dist-tags'] from usePackage()
// TODO: Replace versionHistory with data from useAllPackageVersions()
// TODO: Replace mockChangelogs with real changelog data (e.g. GitHub releases or CHANGELOG.md)

const distTags: Record<string, string> = {
  'latest': '7.26.3',
  'next': '8.0.0-alpha.16',
  'babel-7': '7.26.3',
}

const versionHistory: PackageVersionInfo[] = [
  { version: '8.0.0-alpha.16', time: '2024-12-15T10:00:00Z', hasProvenance: true },
  { version: '8.0.0-alpha.15', time: '2024-11-20T10:00:00Z', hasProvenance: true },
  { version: '8.0.0-alpha.14', time: '2024-10-30T10:00:00Z', hasProvenance: true },
  { version: '8.0.0-alpha.13', time: '2024-10-01T10:00:00Z', hasProvenance: false },
  { version: '7.26.3', time: '2024-12-10T10:00:00Z', hasProvenance: true },
  { version: '7.26.2', time: '2024-11-28T10:00:00Z', hasProvenance: true },
  { version: '7.26.1', time: '2024-11-14T10:00:00Z', hasProvenance: true },
  { version: '7.26.0', time: '2024-10-25T10:00:00Z', hasProvenance: true },
  { version: '7.25.9', time: '2024-10-15T10:00:00Z', hasProvenance: true },
  { version: '7.25.8', time: '2024-09-20T10:00:00Z', hasProvenance: true },
  { version: '7.25.7', time: '2024-08-15T10:00:00Z', hasProvenance: false },
  { version: '7.25.6', time: '2024-07-20T10:00:00Z', hasProvenance: false },
  { version: '7.25.5', time: '2024-06-10T10:00:00Z', hasProvenance: false },
  { version: '7.25.4', time: '2024-05-20T10:00:00Z', hasProvenance: false },
  { version: '7.25.3', time: '2024-04-15T10:00:00Z', hasProvenance: false },
  { version: '7.25.2', time: '2024-03-20T10:00:00Z', hasProvenance: false },
  { version: '7.25.1', time: '2024-03-05T10:00:00Z', hasProvenance: false },
  { version: '7.25.0', time: '2024-02-20T10:00:00Z', hasProvenance: false },
  { version: '7.24.7', time: '2024-03-01T10:00:00Z', hasProvenance: false },
  { version: '7.24.6', time: '2024-02-10T10:00:00Z', hasProvenance: false },
  { version: '7.24.5', time: '2024-01-25T10:00:00Z', hasProvenance: false },
  { version: '7.24.4', time: '2024-01-10T10:00:00Z', hasProvenance: false },
  { version: '7.24.0', time: '2023-12-20T10:00:00Z', hasProvenance: false },
  { version: '7.23.6', time: '2023-12-15T10:00:00Z', hasProvenance: false },
  { version: '7.23.5', time: '2023-11-10T10:00:00Z', hasProvenance: false },
  { version: '7.23.0', time: '2023-09-05T10:00:00Z', hasProvenance: false },
  { version: '7.22.5', time: '2023-07-08T10:00:00Z', hasProvenance: false },
  { version: '7.22.0', time: '2023-05-16T10:00:00Z', hasProvenance: false },
  { version: '7.0.0', time: '2018-08-27T10:00:00Z', hasProvenance: false },
  {
    version: '6.26.0',
    time: '2018-03-14T10:00:00Z',
    hasProvenance: false,
    deprecated: 'Use @babel/types 7.x or later',
  },
  {
    version: '6.25.0',
    time: '2018-01-10T10:00:00Z',
    hasProvenance: false,
    deprecated: 'Use @babel/types 7.x or later',
  },
  {
    version: '6.24.1',
    time: '2017-09-12T10:00:00Z',
    hasProvenance: false,
    deprecated: 'Use @babel/types 7.x or later',
  },
]

// Changelog entries keyed by version. In production this would come from GitHub
// releases or a CHANGELOG.md parsed from the package files.
const mockChangelogs: Record<string, string[]> = {
  '8.0.0-alpha.16': [
    'Added support for TypeScript 5.x type imports in builder helpers',
    'Improved error messages for invalid AST node transformations',
    'Fixed incorrect location tracking for template literals inside tagged expressions',
    'Resolved memory leak in recursive type visitor traversal',
  ],
  '7.26.3': [
    'Fixed edge case in identifier validation for private class fields (#16421)',
    'Corrected span calculation for async generator function expressions',
  ],
  '7.26.0': [
    'Added assert keyword support for import assertions (Stage 3 proposal)',
    'New createTypeAnnotation builder helper for programmatic AST construction',
    'Fixed inconsistent behavior in optional chaining type narrowing',
    'Corrected position data for JSX fragment children with whitespace',
  ],
  '7.25.0': [
    'Introduced satisfies operator support (TypeScript 4.9)',
    'Added experimental decorator metadata helpers behind a flag',
    'Removed deprecated isType aliases — use isTSType instead',
    'Improved clone performance for large ASTs by ~18%',
  ],
  '7.0.0': [
    'Package renamed from babel-types to @babel/types',
    'All APIs now use ES module syntax',
    'Dropped support for Node.js < 6',
    'Removed all deprecated v5 builder aliases',
  ],
}

// ─── Derived data ─────────────────────────────────────────────────────────────

const versionToTagsMap = computed(() => buildVersionToTagsMap(distTags))

const sortedVersions = computed(() =>
  [...versionHistory]
    .sort((a, b) => compare(b.version, a.version))
    .map(v => ({
      ...v,
      tags: versionToTagsMap.value.get(v.version),
      changelog: mockChangelogs[v.version] ?? null,
    })),
)

const tagRows = computed(() => buildTaggedVersionRows(distTags))

function getVersionTime(version: string): string | undefined {
  return versionHistory.find(v => v.version === version)?.time
}

// ─── Changelog expand/collapse ────────────────────────────────────────────────

const expandedChangelogs = ref<Set<string>>(new Set())

function toggleChangelog(version: string) {
  if (expandedChangelogs.value.has(version)) {
    expandedChangelogs.value.delete(version)
  } else {
    expandedChangelogs.value.add(version)
  }
  expandedChangelogs.value = new Set(expandedChangelogs.value)
}

// ─── Jump to version ──────────────────────────────────────────────────────────

const jumpVersion = ref('')
const jumpError = ref('')

function navigateToVersion() {
  const v = jumpVersion.value.trim()
  if (!v) return
  if (!versionHistory.some(entry => entry.version === v)) {
    jumpError.value = `Version "${v}" not found`
    return
  }
  jumpError.value = ''
  router.push(packageRoute(packageName.value, v))
}
</script>

<template>
  <main class="flex-1 flex flex-col">
    <!-- Header (same pattern as code/docs pages) -->
    <header class="border-b border-border bg-bg sticky top-14 z-20">
      <div class="container py-4">
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
      </div>
    </header>

    <!-- Content -->
    <div class="container py-8 flex flex-col lg:flex-row gap-8 items-start">
      <!-- ── Current Tags ─────────────────────────────────────────────────── -->
      <section class="w-full lg:w-72 shrink-0">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 ps-1">Current Tags</h2>
        <div class="rounded-lg border border-border overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border bg-bg-subtle">
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider"
                >
                  Tag
                </th>
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider"
                >
                  Version
                </th>
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider hidden sm:table-cell lg:hidden xl:table-cell"
                >
                  Published
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in tagRows"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-bg-subtle transition-colors"
              >
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span
                      v-for="tag in row.tags"
                      :key="tag"
                      class="text-4xs font-semibold uppercase tracking-wide"
                      :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <LinkBase
                    :to="packageRoute(packageName, row.version)"
                    class="font-mono text-sm"
                    dir="ltr"
                  >
                    {{ row.version }}
                  </LinkBase>
                </td>
                <td class="px-4 py-3 hidden sm:table-cell lg:hidden xl:table-cell">
                  <DateTime
                    v-if="getVersionTime(row.version)"
                    :datetime="getVersionTime(row.version)!"
                    class="text-xs text-fg-subtle"
                    year="numeric"
                    month="short"
                    day="numeric"
                  />
                  <span v-else class="text-xs text-fg-subtle">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ── Version History ──────────────────────────────────────────────── -->
      <section class="flex-1 min-w-0">
        <!-- Header + jump-to-version -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4 ps-1">
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider">
            Version History
            <span class="text-fg-subtle ms-1 normal-case font-normal tracking-normal">
              ({{ sortedVersions.length }})
            </span>
          </h2>
          <div class="flex items-center gap-2">
            <InputBase
              v-model="jumpVersion"
              type="text"
              placeholder="e.g. 7.26.0"
              :aria-label="'Jump to version'"
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
        </div>
        <p v-if="jumpError" role="alert" class="text-red-500 dark:text-red-400 text-xs mb-3 ps-1">
          {{ jumpError }}
        </p>

        <!-- Version list -->
        <div class="rounded-lg border border-border overflow-hidden">
          <div
            v-for="v in sortedVersions"
            :key="v.version"
            class="border-b border-border last:border-0"
          >
            <!-- Version row -->
            <div
              class="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-subtle transition-colors group relative"
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

                <!-- Dist-tags -->
                <div v-if="v.tags?.length" class="flex items-center gap-1 flex-wrap relative z-10">
                  <span
                    v-for="tag in v.tags"
                    :key="tag"
                    class="text-4xs font-semibold uppercase tracking-wide"
                    :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
                  >
                    {{ tag }}
                  </span>
                </div>

                <!-- Deprecated label -->
                <span
                  v-if="v.deprecated"
                  class="text-3xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded relative z-10"
                  :title="v.deprecated"
                >
                  deprecated
                </span>
              </div>

              <!-- Right side: date + provenance + changelog toggle -->
              <div class="flex items-center gap-3 shrink-0 relative z-10">
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
                <!-- Changelog toggle button -->
                <button
                  v-if="v.changelog"
                  type="button"
                  class="flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition-colors rounded focus-visible:outline-accent/70"
                  :aria-expanded="expandedChangelogs.has(v.version)"
                  @click.stop="toggleChangelog(v.version)"
                >
                  <span
                    class="i-lucide:chevron-right w-3 h-3 transition-transform duration-200 motion-reduce:transition-none"
                    :class="{ 'rotate-90': expandedChangelogs.has(v.version) }"
                    aria-hidden="true"
                  />
                  <span class="hidden sm:inline">Changelog</span>
                </button>
              </div>
            </div>

            <!-- Changelog expansion -->
            <div
              v-if="v.changelog"
              class="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
              :class="expandedChangelogs.has(v.version) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
            >
              <div class="overflow-hidden min-h-0">
                <div class="px-4 pb-4 pt-3 border-t border-border bg-bg-subtle">
                  <ul class="space-y-1.5 list-none m-0 p-0">
                    <li
                      v-for="(entry, i) in v.changelog"
                      :key="i"
                      class="flex items-start gap-2 text-sm text-fg-muted"
                    >
                      <span
                        class="i-lucide:minus w-3.5 h-3.5 mt-0.5 text-fg-subtle shrink-0"
                        aria-hidden="true"
                      />
                      {{ entry }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
