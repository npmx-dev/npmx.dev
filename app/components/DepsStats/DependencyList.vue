<script setup lang="ts">
import { SEVERITY_TEXT_COLORS, getHighestSeverity } from '#shared/utils/severity'
import type {
  DirectDeprecatedDependency,
  DirectVulnerableDependency,
} from '#shared/types/dependency-analysis'
import type { DependencyCategory, PackageJsonDependency } from '~/utils/parse-package-json-deps'
import { getOutdatedTooltip, getVersionClass } from '~/utils/npm/outdated-dependencies'
import { packageRoute } from '~/utils/router'

const props = defineProps<{
  dependencies: PackageJsonDependency[]
  selectedName: string | null
}>()

const emit = defineEmits<{
  select: [dep: PackageJsonDependency]
}>()

const { t } = useI18n()
const filter = shallowRef('')
const listScrollRef = useTemplateRef<HTMLElement>('listScrollRef')
const dependencyRows = useTemplateRef<HTMLElement[]>('dependencyRows')
const observedRows = computed(() => dependencyRows.value ?? [])

const categoryOrder: DependencyCategory[] = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
]

const categoryLabels = computed<Record<DependencyCategory, string>>(() => ({
  dependencies: t('compare.dependencies'),
  devDependencies: t('compare.dev_dependencies'),
  peerDependencies: t('compare.peer_dependencies'),
  optionalDependencies: t('compare.optional_dependencies'),
}))

const registryDeps = computed(() => {
  const map: Record<string, string> = {}
  for (const dep of props.dependencies) {
    if (dep.nonRegistry) continue
    map[dep.packageName] = dep.range
  }
  return map
})

const orderedRegistryNames = computed(() => {
  const seen = new Set<string>()
  const names: string[] = []
  for (const dep of props.dependencies) {
    if (dep.nonRegistry || seen.has(dep.packageName)) continue
    seen.add(dep.packageName)
    names.push(dep.packageName)
  }
  return names
})

const outdatedDeps = useOutdatedDependencies(registryDeps)
const replacementDeps = useReplacementDependencies(registryDeps)
const { health, requestHealth } = useDirectDependencyHealth(registryDeps, orderedRegistryNames)

const grouped = computed(() => {
  const query = filter.value.trim().toLowerCase()
  const groups = categoryOrder
    .map(category => {
      const items = props.dependencies.filter(dep => {
        if (dep.category !== category) return false
        if (!query) return true
        return (
          dep.name.toLowerCase().includes(query) ||
          dep.packageName.toLowerCase().includes(query) ||
          dep.range.toLowerCase().includes(query)
        )
      })
      return { category, items, label: categoryLabels.value[category] }
    })
    .filter(group => group.items.length > 0)

  return groups
})

const totalCount = computed(() => props.dependencies.length)

function getVulnerableInfo(dep: PackageJsonDependency): DirectVulnerableDependency | null {
  return health.value.vulnerable[dep.packageName] ?? null
}

function getDeprecatedInfo(dep: PackageJsonDependency): DirectDeprecatedDependency | null {
  return health.value.deprecated[dep.packageName] ?? null
}

function getDepVersionTooltip(dep: PackageJsonDependency) {
  const outdated = outdatedDeps.value[dep.packageName]
  if (outdated) return getOutdatedTooltip(outdated, t)
  if (replacementDeps.value[dep.packageName]) return t('package.dependencies.has_replacement')
  return dep.range
}

function getDepVersionClass(dep: PackageJsonDependency) {
  const outdated = outdatedDeps.value[dep.packageName]
  if (outdated) return getVersionClass(outdated)
  if (replacementDeps.value[dep.packageName]) return 'text-amber-700 dark:text-amber-500'
  return getVersionClass(undefined)
}

useIntersectionObserver(
  observedRows,
  entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      const packageName = (entry.target as HTMLElement).dataset.packageName
      if (packageName) requestHealth(packageName)
    }
  },
  {
    root: listScrollRef,
    rootMargin: '160px 0px',
  },
)
</script>

<template>
  <div class="flex flex-col min-h-0 h-full border border-border rounded-lg overflow-hidden bg-bg">
    <div class="shrink-0 border-b border-border px-3 py-2 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">
          {{ $t('deps_stats.dependencies.title') }}
        </h2>
        <span class="font-mono text-3xs text-fg-muted">
          {{ $t('deps_stats.dependencies.count', { count: totalCount }, totalCount) }}
        </span>
      </div>
      <label class="block">
        <span class="sr-only">{{ $t('deps_stats.dependencies.filter_label') }}</span>
        <InputBase
          v-model="filter"
          type="search"
          :placeholder="$t('deps_stats.dependencies.filter_placeholder')"
          class="w-full"
        />
      </label>
    </div>

    <div ref="listScrollRef" class="relative flex-1 overflow-y-auto">
      <p v-if="grouped.length === 0" class="px-3 py-6 text-sm text-fg-subtle text-center">
        {{
          filter.trim()
            ? $t('deps_stats.dependencies.no_matches')
            : $t('deps_stats.dependencies.empty')
        }}
      </p>

      <section
        v-for="group in grouped"
        :key="group.category"
        class="border-b border-border last:border-b-0"
      >
        <h3
          class="sticky top-0 z-1 px-3 py-1.5 text-3xs uppercase tracking-wider text-fg-subtle bg-bg-subtle border-b border-border"
        >
          {{ group.label }}
          <span class="font-mono ms-1">({{ group.items.length }})</span>
        </h3>
        <ul class="list-none m-0 p-0" :aria-label="group.label">
          <li
            v-for="dep in group.items"
            :key="dep.name"
            ref="dependencyRows"
            :data-package-name="dep.nonRegistry ? undefined : dep.packageName"
          >
            <div
              class="flex items-start gap-2 px-3 py-2 transition-colors duration-100"
              :class="
                selectedName === dep.name ? 'bg-bg-muted text-fg' : 'hover:bg-bg-subtle text-fg'
              "
            >
              <button
                type="button"
                class="flex-1 min-w-0 text-start border-none bg-transparent cursor-pointer p-0 focus-visible:outline-accent/70 focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"
                :aria-current="selectedName === dep.name ? 'true' : undefined"
                @click="emit('select', dep)"
              >
                <span class="font-mono text-sm truncate block">{{ dep.name }}</span>
                <p
                  v-if="dep.name !== dep.packageName"
                  class="mt-0.5 font-mono text-3xs text-fg-muted truncate"
                >
                  → {{ dep.packageName }}
                </p>
                <p
                  v-if="dep.nonRegistry"
                  class="mt-0.5 text-3xs text-amber-700 dark:text-amber-400"
                >
                  {{ $t('deps_stats.dependencies.non_registry') }}
                </p>
              </button>

              <span
                v-if="!dep.nonRegistry"
                class="flex items-center gap-1 shrink-0 max-w-[45%] pt-0.5"
                dir="ltr"
                @click.stop
              >
                <TooltipApp
                  v-if="outdatedDeps[dep.packageName]"
                  class="shrink-0"
                  :class="getVersionClass(outdatedDeps[dep.packageName]!)"
                  :text="getOutdatedTooltip(outdatedDeps[dep.packageName]!, $t)"
                >
                  <button
                    type="button"
                    class="inline-flex items-center justify-center p-1 -m-1"
                    :aria-label="getOutdatedTooltip(outdatedDeps[dep.packageName]!, $t)"
                  >
                    <span class="i-lucide:arrow-up w-3 h-3" aria-hidden="true" />
                  </button>
                </TooltipApp>
                <TooltipApp
                  v-if="replacementDeps[dep.packageName]"
                  class="shrink-0 text-amber-700 dark:text-amber-500"
                  :text="$t('package.dependencies.has_replacement')"
                >
                  <button
                    type="button"
                    class="inline-flex items-center justify-center p-1 -m-1"
                    :aria-label="$t('package.dependencies.has_replacement')"
                  >
                    <span class="i-lucide:lightbulb w-3 h-3" aria-hidden="true" />
                  </button>
                </TooltipApp>
                <LinkBase
                  v-if="getVulnerableInfo(dep)"
                  :to="packageRoute(dep.packageName, getVulnerableInfo(dep)!.version)"
                  class="shrink-0"
                  :class="SEVERITY_TEXT_COLORS[getHighestSeverity(getVulnerableInfo(dep)!.counts)]"
                  :aria-label="$t('package.dependencies.view_vulnerabilities')"
                  :title="
                    $t('package.dependencies.vulnerabilities_count', {
                      count: getVulnerableInfo(dep)!.counts.total,
                    })
                  "
                  classicon="i-lucide:shield-check"
                />
                <LinkBase
                  v-if="getDeprecatedInfo(dep)"
                  :to="packageRoute(dep.packageName, getDeprecatedInfo(dep)!.version)"
                  class="shrink-0 text-purple-700 dark:text-purple-500"
                  :aria-label="$t('package.deprecated.label')"
                  :title="getDeprecatedInfo(dep)!.message"
                  classicon="i-lucide:octagon-alert"
                />
                <span
                  class="font-mono text-3xs truncate"
                  :class="getDepVersionClass(dep)"
                  :title="getDepVersionTooltip(dep)"
                >
                  {{ dep.range }}
                </span>
                <span v-if="outdatedDeps[dep.packageName]" class="sr-only">
                  ({{ getOutdatedTooltip(outdatedDeps[dep.packageName]!, $t) }})
                </span>
                <span v-if="getVulnerableInfo(dep)" class="sr-only">
                  ({{
                    $t('package.dependencies.vulnerabilities_count', {
                      count: getVulnerableInfo(dep)!.counts.total,
                    })
                  }})
                </span>
              </span>
              <span
                v-else
                class="font-mono text-3xs text-fg-subtle shrink-0 truncate max-w-[40%] pt-0.5"
              >
                {{ dep.range }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
