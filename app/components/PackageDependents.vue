<script setup lang="ts">
import { usePackageDependents } from '~/composables/useNpmRegistry'
import { formatCompactNumber } from '~/utils/formatters'

const props = defineProps<{
  packageName: string
}>()

const { data, status } = usePackageDependents(() => props.packageName)

const dependents = computed(() => data.value?.dependents ?? [])
const total = computed(() => data.value?.total ?? 0)

// Expanded state for showing all dependents
const expanded = ref(false)

// Show first 10 by default, all when expanded
const visibleDependents = computed(() => {
  if (expanded.value) {
    return dependents.value
  }
  return dependents.value.slice(0, 10)
})

// Show section only when we have dependents or are loading
const showSection = computed(() => {
  return status.value === 'pending' || dependents.value.length > 0
})
</script>

<template>
  <section v-if="showSection" aria-labelledby="dependents-heading">
    <h2 id="dependents-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
      Dependents
      <span v-if="status === 'success' && total > 0">(top {{ total.toLocaleString() }})</span>
    </h2>

    <!-- Loading state -->
    <div v-if="status === 'pending'" class="space-y-2">
      <div v-for="i in 5" :key="i" class="flex items-center justify-between py-1">
        <div class="skeleton h-4 rounded" :style="{ width: `${60 + (i % 3) * 20}px` }" />
        <div class="skeleton h-3 w-12 rounded" />
      </div>
    </div>

    <!-- Dependents list -->
    <ul
      v-else-if="dependents.length > 0"
      class="space-y-1 list-none m-0 p-0"
      aria-label="Packages that depend on this package"
    >
      <li
        v-for="dependent in visibleDependents"
        :key="dependent.name"
        class="flex items-center justify-between py-1 text-sm gap-2"
      >
        <NuxtLink
          :to="{ name: 'package', params: { package: dependent.name.split('/') } }"
          class="font-mono text-fg-muted hover:text-fg transition-colors duration-200 truncate min-w-0"
        >
          {{ dependent.name }}
        </NuxtLink>
        <span
          v-if="dependent.downloads"
          class="font-mono text-xs text-fg-subtle shrink-0 flex items-center gap-1"
          :title="`${dependent.downloads.toLocaleString()} downloads`"
        >
          <span class="i-carbon-download w-3 h-3" aria-hidden="true" />
          {{ formatCompactNumber(dependent.downloads, { decimals: 1 }) }}
        </span>
      </li>
    </ul>

    <!-- Expand button -->
    <button
      v-if="dependents.length > 10 && !expanded"
      type="button"
      class="mt-2 font-mono text-xs text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
      @click="expanded = true"
    >
      show top {{ dependents.length }}
    </button>
  </section>
</template>
