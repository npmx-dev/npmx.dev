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
// TODO: Replace mockChangelogs with pre-rendered HTML from the server
//       (GitHub releases body or CHANGELOG.md, parsed server-side like README)

const distTags: Record<string, string> = {
  latest: '3.4.21',
  next: '3.5.0-beta.3',
  beta: '3.5.0-beta.3',
  rc: '3.5.0-rc.1',
  alpha: '3.5.0-alpha.5',
  csp: '3.4.21',
  legacy: '2.7.16',
}

const versionHistory: PackageVersionInfo[] = [
  { version: '3.5.0-beta.3', time: '2024-12-18T10:00:00Z', hasProvenance: true },
  { version: '3.5.0-rc.1', time: '2024-12-10T10:00:00Z', hasProvenance: true },
  { version: '3.5.0-alpha.5', time: '2024-11-28T10:00:00Z', hasProvenance: true },
  { version: '3.5.0-alpha.4', time: '2024-11-10T10:00:00Z', hasProvenance: false },
  { version: '3.5.0-alpha.3', time: '2024-10-22T10:00:00Z', hasProvenance: false },
  { version: '3.4.21', time: '2024-12-05T10:00:00Z', hasProvenance: true },
  { version: '3.4.20', time: '2024-11-20T10:00:00Z', hasProvenance: true },
  { version: '3.4.19', time: '2024-11-08T10:00:00Z', hasProvenance: true },
  { version: '3.4.18', time: '2024-10-25T10:00:00Z', hasProvenance: true },
  { version: '3.4.17', time: '2024-10-01T10:00:00Z', hasProvenance: true },
  { version: '3.4.0', time: '2024-02-15T10:00:00Z', hasProvenance: false },
  { version: '3.3.13', time: '2024-01-10T10:00:00Z', hasProvenance: false },
  { version: '3.3.0', time: '2023-05-11T10:00:00Z', hasProvenance: false },
  { version: '3.2.47', time: '2023-03-30T10:00:00Z', hasProvenance: false },
  { version: '3.0.0', time: '2022-09-29T10:00:00Z', hasProvenance: false },
  { version: '2.7.16', time: '2023-12-08T10:00:00Z', hasProvenance: false },
  { version: '2.7.15', time: '2023-09-12T10:00:00Z', hasProvenance: false },
  { version: '2.7.14', time: '2023-06-01T10:00:00Z', hasProvenance: false },
  { version: '2.7.0', time: '2022-07-01T10:00:00Z', hasProvenance: false },
  { version: '2.6.14', time: '2022-03-14T10:00:00Z', hasProvenance: false },
  {
    version: '2.5.22',
    time: '2018-03-20T10:00:00Z',
    hasProvenance: false,
    deprecated: 'Use vue@2.6.x or later',
  },
  {
    version: '2.5.0',
    time: '2017-10-13T10:00:00Z',
    hasProvenance: false,
    deprecated: 'Use vue@2.6.x or later',
  },
  { version: '1.0.28', time: '2016-12-15T10:00:00Z', hasProvenance: false },
]

// Changelog markdown strings keyed by version.
// In production these would be pre-rendered HTML from the server
// (e.g. GitHub release body or CHANGELOG.md, parsed like README).
const mockChangelogs: Record<string, string> = {
  '3.5.0-beta.3': `### Bug Fixes

- Fixed \`v-model\` not triggering update when used with custom modifier on the same component
- Resolved hydration mismatch for \`<Suspense>\` with async setup components

### Performance

- Reduced scheduler flush cost for large component trees with many watchers`,

  '3.5.0-rc.1': `## Vue 3.5 RC

The API is now stable. This release candidate is intended for final testing before the stable release.

### New Features

- \`useTemplateRef()\` — reactive ref bound to a template element by string key
- \`useId()\` — SSR-safe unique ID generation for accessibility attributes
- Deferred \`<Suspense>\` — suspense boundary no longer blocks parent tree rendering

### Breaking Changes

> **Note:** These only affect experimental APIs that were previously behind flags.

- Removed \`v-memo\` on component root nodes — use it on inner elements instead
- \`defineModel()\` local mutation now requires explicit \`local\` option

**Full Changelog**: [v3.4.21...v3.5.0-rc.1](https://github.com/vuejs/core/compare/v3.4.21...v3.5.0-rc.1)`,

  '3.4.21': `### Bug Fixes

- Fixed \`<KeepAlive>\` failing to restore scroll position on re-activation (#10156)
- Corrected \`shallowReadonly\` not preserving array identity on nested access
- Fixed compiler warning for \`v-bind\` shorthand used on \`<slot>\` elements

**Full Changelog**: [v3.4.20...v3.4.21](https://github.com/vuejs/core/compare/v3.4.20...v3.4.21)`,

  '3.4.0': `## Vue 3.4 — "Slam Dunk"

### New Features

- **Reactivity transform removed** — the experimental \`$ref\` sugar has been dropped; use \`ref()\` directly
- **\`v-bind\` shorthand** — \`:foo\` can now be written as just \`:foo\` when binding a same-name prop
- **\`defineModel()\` stable** — two-way binding macro is now stable and no longer requires opt-in
- **Parser rewrite** — the template compiler's parser is 2× faster and produces better error messages

### Breaking Changes

- \`app.config.compilerOptions.isCustomElement\` now receives the full element tag with namespace prefix
- \`@vue/reactivity\` no longer exports \`deferredComputed\` — use \`computed\` with a scheduler instead

\`\`\`ts
// Before
const double = deferredComputed(() => count.value * 2)

// After
const double = computed(() => count.value * 2, { scheduler: queueMicrotask })
\`\`\`

**Full Changelog**: [v3.3.13...v3.4.0](https://github.com/vuejs/core/compare/v3.3.13...v3.4.0)`,

  '3.0.0': `## Vue 3.0 — "One Piece"

The first stable release of Vue 3. Rebuilt from the ground up with the Composition API, TypeScript, and a new reactivity system.

### Highlights

- **Composition API** — \`setup()\`, \`ref()\`, \`reactive()\`, \`computed()\`, \`watch()\`
- **Fragments** — components can now have multiple root nodes
- **Teleport** — render content in a different part of the DOM
- **Suspense** — coordinate async dependency resolution in component trees
- **Improved TypeScript support** — full type inference for component props and emits
- **Tree-shakeable** — global APIs are now ES module exports

### Migration

Vue 3 is not backwards compatible with Vue 2. See the [Migration Guide](https://v3-migration.vuejs.org/) for a full list of breaking changes.

**Full Changelog**: [github.com/vuejs/core](https://github.com/vuejs/core/blob/main/CHANGELOG.md)`,
}

// ─── Markdown rendering ───────────────────────────────────────────────────────
// Minimal block-level markdown parser for changelog content.
// Handles headings, lists, paragraphs, blockquotes, and inline formatting.
// In production this would be replaced by server-rendered HTML (like README).

function parseInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(
      /\[([^\]]+)\]\((https?:[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="nofollow noreferrer noopener">$1</a>',
    )
}

function parseChangelogMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  const out: string[] = []
  let inList = false
  let inBlockquote = false
  let inCodeBlock = false
  let codeLang = ''
  let codeLines: string[] = []

  const flushList = () => {
    if (inList) {
      out.push('</ul>')
      inList = false
    }
  }
  const flushBlockquote = () => {
    if (inBlockquote) {
      out.push('</blockquote>')
      inBlockquote = false
    }
  }

  for (const line of lines) {
    // Code block fence
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        out.push(
          `<pre><code${codeLang ? ` class="language-${codeLang}"` : ''}>${codeLines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n')}</code></pre>`,
        )
        inCodeBlock = false
        codeLines = []
        codeLang = ''
      } else {
        flushList()
        flushBlockquote()
        inCodeBlock = true
        codeLang = line.slice(3).trim()
      }
      continue
    }
    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    const trimmed = line.trim()

    // Blank line
    if (!trimmed) {
      flushList()
      flushBlockquote()
      continue
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList()
      if (!inBlockquote) {
        out.push('<blockquote>')
        inBlockquote = true
      }
      out.push(`<p>${parseInline(trimmed.slice(2))}</p>`)
      continue
    }
    flushBlockquote()

    // Headings
    const h2 = trimmed.match(/^## (.+)/)
    const h3 = trimmed.match(/^### (.+)/)
    if (h2) {
      flushList()
      out.push(`<h2>${parseInline(h2[1]!)}</h2>`)
      continue
    }
    if (h3) {
      flushList()
      out.push(`<h3>${parseInline(h3[1]!)}</h3>`)
      continue
    }

    // List item
    const li = trimmed.match(/^[-*] (.+)/)
    if (li) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${parseInline(li[1]!)}</li>`)
      continue
    }

    // Paragraph
    flushList()
    out.push(`<p>${parseInline(trimmed)}</p>`)
  }

  flushList()
  flushBlockquote()
  return out.join('\n')
}

// ─── Derived data ─────────────────────────────────────────────────────────────

const versionToTagsMap = computed(() => buildVersionToTagsMap(distTags))

const sortedVersions = computed(() =>
  [...versionHistory]
    .sort((a, b) => compare(b.version, a.version))
    .map(v => ({
      ...v,
      tags: versionToTagsMap.value.get(v.version),
      hasChangelog: v.version in mockChangelogs,
    })),
)

const tagRows = computed(() => buildTaggedVersionRows(distTags))

function getVersionTime(version: string): string | undefined {
  return versionHistory.find(v => v.version === version)?.time
}

// ─── Changelog side panel ─────────────────────────────────────────────────────

const selectedChangelogVersion = ref<string | null>(null)

const selectedChangelogHtml = computed(() => {
  if (!selectedChangelogVersion.value) return ''
  const raw = mockChangelogs[selectedChangelogVersion.value]
  return raw ? parseChangelogMarkdown(raw) : ''
})

function toggleChangelog(version: string) {
  selectedChangelogVersion.value = selectedChangelogVersion.value === version ? null : version
}

// ─── Jump to version ──────────────────────────────────────────────────────────

const jumpVersion = ref('')
const jumpError = ref('')

function navigateToVersion() {
  const v = jumpVersion.value.trim()
  if (!v) return
  if (!versionHistory.some(entry => entry.version === v)) {
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
    <div class="container py-8 space-y-8">
      <!-- ── Current Tags ───────────────────────────────────────────────────── -->
      <section class="space-y-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider ps-1">Current Tags</h2>

        <!-- Latest — featured card -->
        <div
          v-if="tagRows[0]"
          class="rounded-lg border border-accent/40 bg-accent/5 px-5 py-4 relative flex items-center justify-between gap-4 hover:bg-accent/8 transition-colors"
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
              v-if="versionHistory.find(v => v.version === tagRows[0].version)?.hasProvenance"
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
        <div v-if="tagRows.length > 1" class="rounded-lg border border-border overflow-hidden">
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
              v-if="versionHistory.find(v => v.version === row.version)?.hasProvenance"
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
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider mb-3 ps-1">
          Version History
          <span class="ms-1 normal-case font-normal tracking-normal">
            ({{ sortedVersions.length }})
          </span>
        </h2>

        <!-- List + changelog side panel -->
        <div class="flex items-start">
          <!-- Version list -->
          <div class="flex-1 min-w-0 rounded-lg border border-border overflow-hidden">
            <div
              v-for="v in sortedVersions"
              :key="v.version"
              class="border-b border-border last:border-0 transition-colors"
              :class="selectedChangelogVersion === v.version ? 'bg-bg-subtle' : ''"
            >
              <div
                class="flex items-center gap-3 px-4 py-2.5 group relative"
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
                  <button
                    v-if="v.hasChangelog"
                    type="button"
                    class="flex items-center gap-1 text-xs transition-colors rounded focus-visible:outline-accent/70"
                    :class="
                      selectedChangelogVersion === v.version
                        ? 'text-fg'
                        : 'text-fg-subtle hover:text-fg'
                    "
                    :aria-expanded="selectedChangelogVersion === v.version"
                    :aria-pressed="selectedChangelogVersion === v.version"
                    @click.stop="toggleChangelog(v.version)"
                  >
                    <span
                      class="i-lucide:chevron-right w-3 h-3 transition-transform duration-200 motion-reduce:transition-none"
                      :class="{ 'rotate-90': selectedChangelogVersion === v.version }"
                      aria-hidden="true"
                    />
                    <span class="hidden sm:inline">Changelog</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Changelog side panel -->
          <div
            class="overflow-hidden shrink-0 transition-[width] duration-200 ease-out motion-reduce:transition-none"
            :class="selectedChangelogVersion ? 'w-[28rem] ms-6' : 'w-0'"
          >
            <!-- Fixed-width inner keeps content from squishing during animation -->
            <div class="w-[28rem] sticky top-28">
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
                  v-html="selectedChangelogHtml"
                />
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

.changelog-body :deep(h2) {
  @apply font-mono font-medium text-fg text-base mt-4 mb-2 pb-1.5 border-b border-border;
}
.changelog-body :deep(h2:first-child) {
  @apply mt-0;
}
.changelog-body :deep(h3) {
  @apply font-mono font-medium text-fg text-sm mt-3 mb-1.5;
}
.changelog-body :deep(h3:first-child) {
  @apply mt-0;
}

.changelog-body :deep(p) {
  @apply mb-2 last:mb-0;
}

.changelog-body :deep(ul) {
  @apply mb-2 ps-4 space-y-1 last:mb-0;
  list-style-type: disc;
}
.changelog-body :deep(li::marker) {
  color: var(--border-hover);
}

.changelog-body :deep(blockquote) {
  @apply border-s-2 border-border ps-3 my-2 text-fg-subtle italic;
}

.changelog-body :deep(code) {
  @apply font-mono text-xs;
  font-size: 0.8em;
  background: var(--bg-muted);
  padding: 0.15em 0.35em;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.changelog-body :deep(pre) {
  @apply rounded-md border border-border overflow-x-auto p-3 my-2;
  background: var(--bg-subtle);
}
.changelog-body :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  font-size: 0.8rem;
  color: var(--fg);
}

.changelog-body :deep(a) {
  @apply underline underline-offset-2 decoration-1 decoration-fg/30 transition-colors duration-150;
}
.changelog-body :deep(a:hover) {
  @apply decoration-accent text-accent;
}

.changelog-body :deep(strong) {
  @apply font-semibold text-fg;
}
</style>
