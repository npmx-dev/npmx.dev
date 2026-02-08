<script setup lang="ts">
import { SEVERITY_TEXT_COLORS, getHighestSeverity } from '#shared/utils/severity'
import { getOutdatedTooltip, getVersionClass } from '~/utils/npm/outdated-dependencies'

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
          <LinkBase :to="packageRoute(dep)" dir="ltr">
            {{ dep }}
          </LinkBase>
          <span class="flex items-center gap-1 max-w-[40%]" dir="ltr">
            <span
              v-if="outdatedDeps[dep]"
              class="shrink-0"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="getOutdatedTooltip(outdatedDeps[dep], $t)"
              aria-hidden="true"
            >
              <span class="i-carbon:warning-alt w-3 h-3" />
            </span>
            <LinkBase
              v-if="getVulnerableDepInfo(dep)"
              :to="packageRoute(dep, getVulnerableDepInfo(dep)!.version)"
              class="shrink-0"
              :class="SEVERITY_TEXT_COLORS[getHighestSeverity(getVulnerableDepInfo(dep)!.counts)]"
              :title="`${getVulnerableDepInfo(dep)!.counts.total} vulnerabilities`"
              classicon="i-carbon:security"
            >
              <span class="sr-only">{{ $t('package.dependencies.view_vulnerabilities') }}</span>
            </LinkBase>
            <LinkBase
              v-if="getDeprecatedDepInfo(dep)"
              :to="packageRoute(dep, getDeprecatedDepInfo(dep)!.version)"
              class="shrink-0 text-purple-500"
              :title="getDeprecatedDepInfo(dep)!.message"
              classicon="i-carbon:warning-hex"
            >
              <span class="sr-only">{{ $t('package.deprecated.label') }}</span>
            </LinkBase>
            <LinkBase
              :to="packageRoute(dep, version)"
              class="truncate"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="outdatedDeps[dep] ? getOutdatedTooltip(outdatedDeps[dep], $t) : version"
            >
              {{ version }}
            </LinkBase>
            <span v-if="outdatedDeps[dep]" class="sr-only">
              ({{ getOutdatedTooltip(outdatedDeps[dep], $t) }})
            </span>
            <span v-if="getVulnerableDepInfo(dep)" class="sr-only">
              ({{ getVulnerableDepInfo(dep)!.counts.total }} vulnerabilities)
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
      <ul class="space-y-1 list-none m-0" :aria-label="$t('package.peer_dependencies.list_label')">
        <li
          v-for="peer in sortedPeerDependencies.slice(0, peerDepsExpanded ? undefined : 10)"
          :key="peer.name"
          class="flex items-center justify-between py-1 text-sm gap-1 min-w-0"
        >
          <div class="flex items-center gap-1 min-w-0 flex-1">
            <LinkBase :to="packageRoute(peer.name)" class="truncate" dir="ltr">
              {{ peer.name }}
            </LinkBase>
            <TagStatic v-if="peer.optional" :title="$t('package.dependencies.optional')">
              {{ $t('package.dependencies.optional') }}
            </TagStatic>
          </div>
          <LinkBase
            :to="packageRoute(peer.name, peer.version)"
            class="truncate"
            :title="peer.version"
            dir="ltr"
          >
            {{ peer.version }}
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
        class="space-y-1 list-none m-0"
        :aria-label="$t('package.optional_dependencies.list_label')"
      >
        <li
          v-for="[dep, version] in sortedOptionalDependencies.slice(
            0,
            optionalDepsExpanded ? undefined : 10,
          )"
          :key="dep"
          class="flex items-center justify-between py-1 text-sm gap-2"
        >
          <LinkBase :to="packageRoute(dep)" class="truncate" dir="ltr">
            {{ dep }}
          </LinkBase>
          <LinkBase :to="packageRoute(dep, version)" class="truncate" :title="version" dir="ltr">
            {{ version }}
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
