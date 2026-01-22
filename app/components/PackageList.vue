<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types'

defineProps<{
  /** List of search results to display */
  results: NpmSearchResult[]
  /** Heading level for package names */
  headingLevel?: 'h2' | 'h3'
  /** Whether to show publisher username on cards */
  showPublisher?: boolean
}>()
</script>

<template>
  <ol class="space-y-3 list-none m-0 p-0">
    <li
      v-for="(result, index) in results"
      :key="result.package.name"
      class="animate-fade-in animate-fill-both"
      :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
    >
      <PackageCard
        :result="result"
        :heading-level="headingLevel"
        :show-publisher="showPublisher"
      />
    </li>
  </ol>
</template>
