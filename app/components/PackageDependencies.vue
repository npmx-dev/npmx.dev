<script setup lang="ts">
const props = defineProps<{
  packageName: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
  optionalDependencies?: Record<string, string>
}>()

// Fetch outdated info for dependencies
const outdatedDeps = useOutdatedDependencies(() => props.dependencies)

// Expanded state for each section
const depsExpanded = ref(false)
const peerDepsExpanded = ref(false)
const optionalDepsExpanded = ref(false)

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
    <section v-if="sortedDependencies.length > 0" aria-labelledby="dependencies-heading">
      <h2 id="dependencies-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
        Dependencies ({{ sortedDependencies.length }})
      </h2>
      <ul class="space-y-1 list-none m-0 p-0" aria-label="Package dependencies">
        <li
          v-for="[dep, version] in sortedDependencies.slice(0, depsExpanded ? undefined : 10)"
          :key="dep"
          class="flex items-center justify-between py-1 text-sm gap-2"
        >
          <NuxtLink
            :to="{ name: 'package', params: { package: dep.split('/') } }"
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
          >
            {{ dep }}
          </NuxtLink>
          <span class="flex items-center gap-1">
            <span
              v-if="outdatedDeps[dep]"
              class="shrink-0"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="getOutdatedTooltip(outdatedDeps[dep])"
              aria-hidden="true"
            >
              <span class="i-carbon-warning-alt w-3 h-3 block" />
            </span>
            <NuxtLink
              :to="{ name: 'package', params: { package: [...dep.split('/'), 'v', version] } }"
              class="font-mono text-xs text-right truncate"
              :class="getVersionClass(outdatedDeps[dep])"
              :title="outdatedDeps[dep] ? getOutdatedTooltip(outdatedDeps[dep]) : version"
            >
              {{ version }}
            </NuxtLink>
            <span v-if="outdatedDeps[dep]" class="sr-only">
              ({{ getOutdatedTooltip(outdatedDeps[dep]) }})
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
        show all {{ sortedDependencies.length }} deps
      </button>
    </section>

    <!-- Peer Dependencies -->
    <section v-if="sortedPeerDependencies.length > 0" aria-labelledby="peer-dependencies-heading">
      <h2
        id="peer-dependencies-heading"
        class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
      >
        Peer Dependencies ({{ sortedPeerDependencies.length }})
      </h2>
      <ul class="space-y-1 list-none m-0 p-0" aria-label="Package peer dependencies">
        <li
          v-for="peer in sortedPeerDependencies.slice(0, peerDepsExpanded ? undefined : 10)"
          :key="peer.name"
          class="flex items-center justify-between py-1 text-sm gap-2"
        >
          <div class="flex items-center gap-2 min-w-0">
            <NuxtLink
              :to="{ name: 'package', params: { package: peer.name.split('/') } }"
              class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate"
            >
              {{ peer.name }}
            </NuxtLink>
            <span
              v-if="peer.optional"
              class="px-1 py-0.5 font-mono text-[10px] text-fg-subtle bg-bg-muted border border-border rounded shrink-0"
              title="Optional peer dependency"
            >
              optional
            </span>
          </div>
          <NuxtLink
            :to="{
              name: 'package',
              params: { package: [...peer.name.split('/'), 'v', peer.version] },
            }"
            class="font-mono text-xs text-fg-subtle max-w-[40%] text-right truncate"
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
        show all {{ sortedPeerDependencies.length }} peer deps
      </button>
    </section>

    <!-- Optional Dependencies -->
    <section
      v-if="sortedOptionalDependencies.length > 0"
      aria-labelledby="optional-dependencies-heading"
    >
      <h2
        id="optional-dependencies-heading"
        class="text-xs text-fg-subtle uppercase tracking-wider mb-3"
      >
        Optional Dependencies ({{ sortedOptionalDependencies.length }})
      </h2>
      <ul class="space-y-1 list-none m-0 p-0" aria-label="Package optional dependencies">
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
            class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
          >
            {{ dep }}
          </NuxtLink>
          <NuxtLink
            :to="{ name: 'package', params: { package: [...dep.split('/'), 'v', version] } }"
            class="font-mono text-xs text-fg-subtle max-w-[50%] text-right truncate"
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
        show all {{ sortedOptionalDependencies.length }} optional deps
      </button>
    </section>
  </div>
</template>
