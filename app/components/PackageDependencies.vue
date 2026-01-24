<script setup lang="ts">
const props = defineProps<{
  packageName: string
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}>()

// Expanded state for each section
const depsExpanded = ref(false)
const peerDepsExpanded = ref(false)

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

// Check if a version string is "long" (multiple alternatives)
function isLongVersion(version: string): boolean {
  return version.length > 20 || version.includes('||')
}

// Truncate long version strings for display
function truncateVersion(version: string, maxLength = 20): string {
  if (version.length <= maxLength) return version
  return `${version.slice(0, maxLength)}…`
}
</script>

<template>
  <div class="space-y-8">
    <!-- Dependencies -->
    <section v-if="sortedDependencies.length > 0" aria-labelledby="dependencies-heading">
      <div class="flex items-center justify-between mb-3">
        <h2 id="dependencies-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
          Dependencies ({{ sortedDependencies.length }})
        </h2>
        <a
          :href="`https://npmgraph.js.org/?q=${packageName}`"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle text-fg-subtle"
          aria-label="View dependency graph"
          title="View dependency graph"
        >
          <span class="text-xs uppercase tracking-wider"> Graph </span>
        </a>
      </div>
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
          <span
            class="font-mono text-xs text-fg-subtle max-w-[50%] text-right"
            :class="isLongVersion(version) ? 'truncate' : 'shrink-0'"
            :title="isLongVersion(version) ? version : undefined"
          >
            {{ isLongVersion(version) ? truncateVersion(version) : version }}
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
          <span
            class="font-mono text-xs text-fg-subtle max-w-[40%] text-right"
            :class="isLongVersion(peer.version) ? 'truncate' : 'shrink-0'"
            :title="isLongVersion(peer.version) ? peer.version : undefined"
          >
            {{ isLongVersion(peer.version) ? truncateVersion(peer.version) : peer.version }}
          </span>
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
  </div>
</template>
