<script setup lang="ts">
import { useDependencyAnalysis } from '~/composables/useDependencyAnalysis'
import { SEVERITY_TEXT_COLORS, getHighestSeverity } from '#shared/utils/severity'

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
</script>

<template>
  <div class="space-y-8">
    <!-- Dependencies -->
    <CollapsibleSection
      v-if="sortedDependencies.length > 0"
      id="dependencies"
      :title="$t('package.dependencies.title', { count: sortedDependencies.length })"
    >
      <ul class="space-y-1 list-none m-0 p-0" :aria-label="$t('package.dependencies.list_label')">
        <li
          v-for="[dep, version] in sortedDependencies.slice(0, depsExpanded ? undefined : 10)"
          :key="dep"
          class="flex items-center justify-between py-1 text-sm gap-2"
        >
          <NuxtLink
            :to="{ name: 'package', params: { package: dep.split('/') } }"
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0 flex-1"
          >
            {{ dep }}
          </NuxtLink>
          <span class="flex items-center gap-1 max-w-[40%]">
            <span
              v-if="outdatedDeps[dep]"
              class="shrink-0"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="getOutdatedTooltip(outdatedDeps[dep], $t)"
              aria-hidden="true"
            >
              <span class="i-carbon:warning-alt w-3 h-3 block" />
            </span>
            <NuxtLink
              v-if="getVulnerableDepInfo(dep)"
              :to="{
                name: 'package',
                params: { package: [...dep.split('/'), 'v', getVulnerableDepInfo(dep)!.version] },
              }"
              class="shrink-0"
              :class="SEVERITY_TEXT_COLORS[getHighestSeverity(getVulnerableDepInfo(dep)!.counts)]"
              :title="`${getVulnerableDepInfo(dep)!.counts.total} vulnerabilities`"
            >
              <span class="i-carbon:security w-3 h-3 block" aria-hidden="true" />
              <span class="sr-only">{{ $t('package.dependencies.view_vulnerabilities') }}</span>
            </NuxtLink>
            <NuxtLink
              v-if="getDeprecatedDepInfo(dep)"
              :to="{
                name: 'package',
                params: { package: [...dep.split('/'), 'v', getDeprecatedDepInfo(dep)!.version] },
              }"
              class="shrink-0 text-purple-500"
              :title="getDeprecatedDepInfo(dep)!.message"
            >
              <span class="i-carbon-warning-hex w-3 h-3 block" aria-hidden="true" />
              <span class="sr-only">{{ $t('package.deprecated.label') }}</span>
            </NuxtLink>
            <NuxtLink
              :to="{
                name: 'package',
                params: { package: [...dep.split('/'), 'v', version] },
              }"
              class="font-mono text-xs text-end truncate"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="outdatedDeps[dep] ? getOutdatedTooltip(outdatedDeps[dep], $t) : version"
            >
              {{ version }}
            </NuxtLink>
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
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="depsExpanded = true"
      >
        {{
          $t('package.dependencies.show_all', {
            count: sortedDependencies.length,
          })
        }}
      </button>
    </CollapsibleSection>

    <!-- Peer Dependencies -->
    <CollapsibleSection
      v-if="sortedPeerDependencies.length > 0"
      id="peer-dependencies"
      :title="
        $t('package.peer_dependencies.title', {
          count: sortedPeerDependencies.length,
        })
      "
    >
      <ul
        class="space-y-1 list-none m-0 p-0"
        :aria-label="$t('package.peer_dependencies.list_label')"
      >
        <li
          v-for="peer in sortedPeerDependencies.slice(0, peerDepsExpanded ? undefined : 10)"
          :key="peer.name"
          class="flex items-center justify-between py-1 text-sm gap-1 min-w-0"
        >
          <div class="flex items-center gap-1 min-w-0 flex-1">
            <NuxtLink
              :to="{
                name: 'package',
                params: { package: peer.name.split('/') },
              }"
              class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate"
            >
              {{ peer.name }}
            </NuxtLink>
            <span
              v-if="peer.optional"
              class="px-1 py-0.5 font-mono text-[10px] text-fg-subtle bg-bg-muted border border-border rounded shrink-0"
              :title="$t('package.dependencies.optional')"
            >
              {{ $t('package.dependencies.optional') }}
            </span>
          </div>
          <NuxtLink
            :to="{
              name: 'package',
              params: { package: [...peer.name.split('/'), 'v', peer.version] },
            }"
            class="font-mono text-xs text-fg-subtle max-w-[40%] truncate"
            :title="peer.version"
          >
            {{ peer.version }}
          </NuxtLink>
        </li>
      </ul>
      <button
        v-if="sortedPeerDependencies.length > 10 && !peerDepsExpanded"
        type="button"
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="peerDepsExpanded = true"
      >
        {{
          $t('package.peer_dependencies.show_all', {
            count: sortedPeerDependencies.length,
          })
        }}
      </button>
    </CollapsibleSection>

    <!-- Optional Dependencies -->
    <CollapsibleSection
      v-if="sortedOptionalDependencies.length > 0"
      id="optional-dependencies"
      :title="
        $t('package.optional_dependencies.title', {
          count: sortedOptionalDependencies.length,
        })
      "
    >
      <ul
        class="space-y-1 list-none m-0 p-0"
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
          <NuxtLink
            :to="{ name: 'package', params: { package: dep.split('/') } }"
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0 flex-1"
          >
            {{ dep }}
          </NuxtLink>
          <NuxtLink
            :to="{
              name: 'package',
              params: { package: [...dep.split('/'), 'v', version] },
            }"
            class="font-mono text-xs text-fg-subtle max-w-[40%] text-end truncate"
            :title="version"
          >
            {{ version }}
          </NuxtLink>
        </li>
      </ul>
      <button
        v-if="sortedOptionalDependencies.length > 10 && !optionalDepsExpanded"
        type="button"
        class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        @click="optionalDepsExpanded = true"
      >
        {{
          $t('package.optional_dependencies.show_all', {
            count: sortedOptionalDependencies.length,
          })
        }}
      </button>
    </CollapsibleSection>
  </div>
</template>
