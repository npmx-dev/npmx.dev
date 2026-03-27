<script setup lang="ts">
import { SEVERITY_TEXT_COLORS, getHighestSeverity } from '#shared/utils/severity'
import {
  getOutdatedTooltip,
  getVersionClass,
  parseDepValue,
} from '~/utils/npm/outdated-dependencies'

const { t } = useI18n()

const props = defineProps<{
  packageName: string
  version: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  optionalDependencies?: Record<string, string>
}>()

// Fetch outdated info for dependencies
const outdatedDeps = useOutdatedDependencies(() => props.dependencies)

// Fetch replacement suggestions for dependencies
const replacementDeps = useReplacementDependencies(() => props.dependencies)

// Get vulnerability info from shared cache (already fetched by PackageVulnerabilityTree)
const { data: vulnTree } = useDependencyAnalysis(
  () => props.packageName,
  () => props.version,
)

// Check if a dependency has vulnerabilities (only direct deps)
function getVulnerableDepInfo(depName: string) {
  if (!vulnTree.value) return null
  return vulnTree.value.vulnerablePackages.find(p => p.name === depName && p.depth === 'direct')
}

// Check if a dependency is deprecated (only direct deps)
function getDeprecatedDepInfo(depName: string) {
  if (!vulnTree.value) return null
  return vulnTree.value.deprecatedPackages.find(p => p.name === depName && p.depth === 'direct')
}

// Expanded state for each section
const depsExpanded = shallowRef(false)
const peerDepsExpanded = shallowRef(false)
const optionalDepsExpanded = shallowRef(false)

// Sort dependencies alphabetically
const sortedDependencies = computed(() => {
  if (!props.dependencies) return []
  return Object.entries(props.dependencies).sort(([a], [b]) => a.localeCompare(b))
})

// Sort peer dependencies alphabetically, with required first then optional
const sortedPeerDependencies = computed(() => {
  if (!props.peerDependencies) return []

  return Object.entries(props.peerDependencies)
    .map(([name, version]) => ({
      name,
      version,
      optional: props.peerDependenciesMeta?.[name]?.optional ?? false,
    }))
    .sort((a, b) => {
      // Required first, then optional
      if (a.optional !== b.optional) return a.optional ? 1 : -1
      return a.name.localeCompare(b.name)
    })
})

// Sort optional dependencies alphabetically
const sortedOptionalDependencies = computed(() => {
  if (!props.optionalDependencies) return []
  return Object.entries(props.optionalDependencies).sort(([a], [b]) => a.localeCompare(b))
})

// Get version tooltip (key for outdated lookup, realName for vuln/replacement lookup)
function getDepVersionTooltip(key: string, realName: string, version: string) {
  const outdated = outdatedDeps.value[key]
  if (outdated) return getOutdatedTooltip(outdated, t)
  if (getVulnerableDepInfo(realName) || getDeprecatedDepInfo(realName)) return version
  if (replacementDeps.value[realName]) return t('package.dependencies.has_replacement')
  return version
}

// Get version class (key for outdated lookup, realName for vuln/replacement lookup)
function getDepVersionClass(key: string, realName: string) {
  const outdated = outdatedDeps.value[key]
  if (outdated) return getVersionClass(outdated)
  if (getVulnerableDepInfo(realName) || getDeprecatedDepInfo(realName))
    return getVersionClass(undefined)
  if (replacementDeps.value[realName]) return 'text-amber-700 dark:text-amber-500'
  return getVersionClass(undefined)
}

// Resolve npm: aliases — returns the real package name for links
function depName(key: string, value: string): string {
  return parseDepValue(value).name ?? key
}

// Resolve npm: aliases — returns the version range for display
function depRange(value: string): string {
  return parseDepValue(value).range ?? value
}

const numberFormatter = useNumberFormatter()
</script>

<template>
  <div class="space-y-8">
    <!-- Dependencies -->
    <CollapsibleSection
      v-if="sortedDependencies.length > 0"
      id="dependencies"
      :title="
        $t(
          'package.dependencies.title',
          {
            count: numberFormatter.format(sortedDependencies.length),
          },
          sortedDependencies.length,
        )
      "
    >
      <ul class="space-y-1 list-none m-0" :aria-label="$t('package.dependencies.list_label')">
        <li
          v-for="[dep, version] in sortedDependencies.slice(0, depsExpanded ? undefined : 10)"
          :key="dep"
          class="flex items-center justify-between py-1 text-sm gap-2"
        >
          <LinkBase :to="packageRoute(depName(dep, version))" class="block truncate" dir="ltr">
            {{ dep }}
          </LinkBase>
          <span class="flex items-center gap-1 max-w-[40%]" dir="ltr">
            <TooltipApp
              v-if="outdatedDeps[dep]"
              class="shrink-0"
              :class="getVersionClass(outdatedDeps[dep])"
              :text="getOutdatedTooltip(outdatedDeps[dep], $t)"
            >
              <button
                type="button"
                class="inline-flex items-center justify-center p-2 -m-2"
                :aria-label="getOutdatedTooltip(outdatedDeps[dep], $t)"
              >
                <span class="i-lucide:circle-alert w-3 h-3" aria-hidden="true" />
              </button>
            </TooltipApp>
            <TooltipApp
              v-if="replacementDeps[depName(dep, version)]"
              class="shrink-0 text-amber-700 dark:text-amber-500"
              :text="$t('package.dependencies.has_replacement')"
            >
              <button
                type="button"
                class="inline-flex items-center justify-center p-2 -m-2"
                :aria-label="$t('package.dependencies.has_replacement')"
              >
                <span class="i-lucide:lightbulb w-3 h-3" aria-hidden="true" />
              </button>
            </TooltipApp>
            <LinkBase
              v-if="getVulnerableDepInfo(depName(dep, version))"
              :to="
                packageRoute(
                  depName(dep, version),
                  getVulnerableDepInfo(depName(dep, version))!.version,
                )
              "
              class="shrink-0"
              :class="
                SEVERITY_TEXT_COLORS[
                  getHighestSeverity(getVulnerableDepInfo(depName(dep, version))!.counts)
                ]
              "
              :title="
                $t('package.dependencies.vulnerabilities_count', {
                  count: getVulnerableDepInfo(depName(dep, version))!.counts.total,
                })
              "
              classicon="i-lucide:shield-check"
            >
              <span class="sr-only">{{ $t('package.dependencies.view_vulnerabilities') }}</span>
            </LinkBase>
            <LinkBase
              v-if="getDeprecatedDepInfo(depName(dep, version))"
              :to="
                packageRoute(
                  depName(dep, version),
                  getDeprecatedDepInfo(depName(dep, version))!.version,
                )
              "
              class="shrink-0 text-purple-700 dark:text-purple-500"
              :title="getDeprecatedDepInfo(depName(dep, version))!.message"
              classicon="i-lucide:octagon-alert"
            >
              <span class="sr-only">{{ $t('package.deprecated.label') }}</span>
            </LinkBase>
            <LinkBase
              :to="packageRoute(depName(dep, version), depRange(version))"
              class="block truncate"
              :class="getDepVersionClass(dep, depName(dep, version))"
              :title="getDepVersionTooltip(dep, depName(dep, version), depRange(version))"
            >
              {{ depRange(version) }}
            </LinkBase>
            <span v-if="outdatedDeps[dep]" class="sr-only">
              ({{ getOutdatedTooltip(outdatedDeps[dep], $t) }})
            </span>
            <span v-if="getVulnerableDepInfo(depName(dep, version))" class="sr-only">
              ({{
                $t('package.dependencies.vulnerabilities_count', {
                  count: getVulnerableDepInfo(depName(dep, version))!.counts.total,
                })
              }})
            </span>
          </span>
        </li>
      </ul>
      <button
        v-if="sortedDependencies.length > 10 && !depsExpanded"
        type="button"
        class="my-2 ms-1 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        @click="depsExpanded = true"
      >
        {{
          $t(
            'package.dependencies.show_all',
            {
              count: numberFormatter.format(sortedDependencies.length),
            },
            sortedDependencies.length,
          )
        }}
      </button>
    </CollapsibleSection>

    <!-- Peer Dependencies -->
    <CollapsibleSection
      v-if="sortedPeerDependencies.length > 0"
      id="peer-dependencies"
      :title="
        $t('package.peer_dependencies.title', {
          count: numberFormatter.format(sortedPeerDependencies.length),
        })
      "
    >
      <ul
        class="px-1 space-y-1 list-none m-0"
        :aria-label="$t('package.peer_dependencies.list_label')"
      >
        <li
          v-for="peer in sortedPeerDependencies.slice(0, peerDepsExpanded ? undefined : 10)"
          :key="peer.name"
          class="flex items-center justify-between py-1 text-sm gap-1 min-w-0"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <LinkBase
              :to="packageRoute(depName(peer.name, peer.version))"
              class="block max-w-[70%] break-words"
              dir="ltr"
            >
              {{ peer.name }}
            </LinkBase>
            <TagStatic v-if="peer.optional" :title="$t('package.dependencies.optional')">
              {{ $t('package.dependencies.optional') }}
            </TagStatic>
          </div>
          <LinkBase
            :to="packageRoute(depName(peer.name, peer.version), depRange(peer.version))"
            class="block truncate max-w-[30%]"
            :title="depRange(peer.version)"
            dir="ltr"
          >
            {{ depRange(peer.version) }}
          </LinkBase>
        </li>
      </ul>
      <button
        v-if="sortedPeerDependencies.length > 10 && !peerDepsExpanded"
        type="button"
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70"
        @click="peerDepsExpanded = true"
      >
        {{
          $t(
            'package.peer_dependencies.show_all',
            {
              count: numberFormatter.format(sortedPeerDependencies.length),
            },
            sortedPeerDependencies.length,
          )
        }}
      </button>
    </CollapsibleSection>

    <!-- Optional Dependencies -->
    <CollapsibleSection
      v-if="sortedOptionalDependencies.length > 0"
      id="optional-dependencies"
      :title="
        $t(
          'package.optional_dependencies.title',
          {
            count: numberFormatter.format(sortedOptionalDependencies.length),
          },
          sortedOptionalDependencies.length,
        )
      "
    >
      <ul
        class="px-1 space-y-1 list-none m-0"
        :aria-label="$t('package.optional_dependencies.list_label')"
      >
        <li
          v-for="[dep, version] in sortedOptionalDependencies.slice(
            0,
            optionalDepsExpanded ? undefined : 10,
          )"
          :key="dep"
          class="flex items-baseline justify-between py-1 text-sm gap-2"
        >
          <LinkBase
            :to="packageRoute(depName(dep, version))"
            class="block max-w-[80%] break-words"
            dir="ltr"
          >
            {{ dep }}
          </LinkBase>
          <LinkBase
            :to="packageRoute(depName(dep, version), depRange(version))"
            class="block truncate"
            :title="depRange(version)"
            dir="ltr"
          >
            {{ depRange(version) }}
          </LinkBase>
        </li>
      </ul>
      <button
        v-if="sortedOptionalDependencies.length > 10 && !optionalDepsExpanded"
        type="button"
        class="mt-2 truncate"
        @click="optionalDepsExpanded = true"
      >
        {{
          $t(
            'package.optional_dependencies.show_all',
            {
              count: numberFormatter.format(sortedOptionalDependencies.length),
            },
            sortedOptionalDependencies.length,
          )
        }}
      </button>
    </CollapsibleSection>
  </div>
</template>
