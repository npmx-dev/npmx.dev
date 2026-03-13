<script setup lang="ts">
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

// ─── Mock data ────────────────────────────────────────────────────────────────
// TODO: Replace with real data from usePackage() / fetchAllPackageVersions()

interface VersionEntry {
  version: string
  time: string
  deprecated?: string
  hasProvenance: boolean
}

const mockDistTags: Record<string, string> = {
  'latest': '7.26.3',
  'next': '8.0.0-alpha.16',
  'babel-7': '7.26.3',
}

const mockVersions: VersionEntry[] = [
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

// ─── Derived data ─────────────────────────────────────────────────────────────

const versionToTagsMap = computed(() => buildVersionToTagsMap(mockDistTags))

const sortedVersions = computed(() =>
  [...mockVersions]
    .sort((a, b) => compare(b.version, a.version))
    .map(v => ({ ...v, tags: versionToTagsMap.value.get(v.version) })),
)

const tagRows = computed(() => buildTaggedVersionRows(mockDistTags))

function getVersionTime(version: string): string | undefined {
  return mockVersions.find(v => v.version === version)?.time
}

// ─── Jump to version ──────────────────────────────────────────────────────────

const jumpVersion = ref('')
const jumpError = ref('')

function navigateToVersion() {
  const v = jumpVersion.value.trim()
  if (!v) return
  if (!mockVersions.some(mv => mv.version === v)) {
    jumpError.value = `Version "${v}" not found`
    return
  }
  jumpError.value = ''
  router.push(packageRoute(packageName.value, v))
}
</script>

<template>
  <main class="container flex-1 w-full py-8">
    <div class="max-w-3xl mx-auto">
      <!-- Back link -->
      <div class="mb-6">
        <LinkBase :to="packageRoute(packageName)" classicon="i-lucide:arrow-left" class="text-sm">
          <span class="font-mono" dir="ltr">{{ packageName }}</span>
        </LinkBase>
      </div>

      <!-- Page heading -->
      <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-8" dir="ltr">
        {{ packageName }}
        <span class="text-fg-muted font-normal text-lg sm:text-2xl ms-2">· Version History</span>
      </h1>

      <!-- ── Current Tags ─────────────────────────────────────────────────── -->
      <section class="mb-10">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 ps-1">Current Tags</h2>
        <div class="rounded-lg border border-border overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-border bg-bg-subtle">
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider w-1/3"
                >
                  Tag
                </th>
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider w-1/3"
                >
                  Version
                </th>
                <th
                  class="text-start px-4 py-2.5 text-xs text-fg-subtle font-medium uppercase tracking-wider hidden sm:table-cell"
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
                <td class="px-4 py-3 hidden sm:table-cell">
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
      <section>
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
            class="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-bg-subtle transition-colors group relative"
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

            <!-- Right side: date + provenance -->
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
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
