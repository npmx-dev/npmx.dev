<script setup lang="ts">
import type { PackageJsonDependency } from '~/utils/parse-package-json-deps'

defineProps<{
  dependency: PackageJsonDependency | null
}>()
</script>

<template>
  <div class="flex flex-col min-h-0 h-full border border-border rounded-lg overflow-hidden bg-bg">
    <div
      v-if="!dependency"
      class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div class="i-lucide:package-search w-10 h-10 text-fg-subtle mb-3" aria-hidden="true" />
      <h2 class="font-mono text-lg text-fg-muted mb-2">
        {{ $t('deps_stats.stats.empty_title') }}
      </h2>
      <p class="text-sm text-fg-subtle max-w-sm">
        {{ $t('deps_stats.stats.empty_description') }}
      </p>
    </div>

    <div
      v-else-if="dependency.nonRegistry"
      class="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div class="i-lucide:unplug w-10 h-10 text-fg-subtle mb-3" aria-hidden="true" />
      <h2 class="font-mono text-lg text-fg-muted mb-2">
        {{ $t('deps_stats.stats.non_registry_title') }}
      </h2>
      <p class="text-sm text-fg-subtle max-w-sm">
        {{ $t('deps_stats.stats.non_registry_description') }}
      </p>
    </div>

    <DepsStatsDependencyStatsPanel
      v-else
      :key="dependency.packageName"
      :package-name="dependency.packageName"
      :declared-range="dependency.range"
    />
  </div>
</template>
