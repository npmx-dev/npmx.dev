<script setup lang="ts">
import type { InstalledPackage } from '~/bundler/types'

type SortOption = 'level' | 'size' | 'installedBy' | 'dependencies' | 'name'

const SORT_COMPARATORS: Record<SortOption, (a: InstalledPackage, b: InstalledPackage) => number> = {
  level: (a, b) => a.level - b.level || a.name.localeCompare(b.name),
  size: (a, b) => b.size - a.size || a.name.localeCompare(b.name),
  installedBy: (a, b) => b.dependents.length - a.dependents.length || a.name.localeCompare(b.name),
  dependencies: (a, b) =>
    b.dependencies.length - a.dependencies.length || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
}

const SORT_OPTIONS: SortOption[] = ['level', 'size', 'installedBy', 'dependencies', 'name']

const props = defineProps<{
  packages: InstalledPackage[]
  installSize: number
  excludePeers?: boolean
}>()

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const filter = ref('')
const sortBy = ref<SortOption>('level')

// filter out peer packages when excludePeers is true
const displayPackages = computed(() => {
  return props.excludePeers ? props.packages.filter(p => !p.isPeer) : props.packages
})

const displayInstallSize = computed(() => {
  return displayPackages.value.reduce((sum, pkg) => sum + pkg.size, 0)
})

const filteredAndSorted = computed(() => {
  const filterText = filter.value.toLowerCase()
  const comparator = SORT_COMPARATORS[sortBy.value]

  let result = displayPackages.value

  if (filterText) {
    result = result.filter(pkg => pkg.name.toLowerCase().includes(filterText))
  } else {
    result = [...result]
  }

  return [...result].toSorted(comparator)
})
</script>

<template>
  <div>
    <!-- header with total -->
    <div class="flex flex-wrap items-baseline justify-between gap-4 mb-4">
      <h2 class="text-sm font-semibold text-fg-subtle uppercase tracking-wider">
        {{ $t('impact.install_size') }}
      </h2>
      <div class="flex items-baseline gap-2">
        <span class="text-sm font-mono font-semibold text-fg">
          {{ formatBytes(displayInstallSize) }}
        </span>
        <span class="text-fg-subtle text-sm">
          {{ $t('impact.total_unpacked', { count: displayPackages.length }) }}
        </span>
      </div>
    </div>

    <!-- size breakdown bar -->
    <div class="mb-4">
      <ImpactDependencyBar :packages="displayPackages" :install-size="displayInstallSize" />
    </div>

    <!-- filter and sort controls -->
    <div
      v-if="displayPackages.length > 1"
      class="flex flex-col gap-3 sm:flex-row sm:items-center mb-4"
    >
      <!-- filter input -->
      <div class="relative flex-1">
        <span
          class="i-carbon-search absolute inset-is-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
          aria-hidden="true"
        />
        <input
          v-model="filter"
          type="text"
          :placeholder="$t('impact.filter_placeholder')"
          class="w-full ps-9 pe-3 py-1.5 font-mono text-sm bg-bg-subtle border border-border rounded text-fg placeholder:text-fg-subtle transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
        />
      </div>

      <!-- sort dropdown -->
      <div class="relative">
        <select
          v-model="sortBy"
          class="w-full sm:w-auto px-3 py-1.5 pe-8 font-mono text-sm bg-bg-subtle border border-border rounded text-fg transition-colors duration-200 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 appearance-none cursor-pointer"
        >
          <option v-for="key in SORT_OPTIONS" :key="key" :value="key">
            {{ $t(`impact.sort.${key}`) }}
          </option>
        </select>
        <span
          class="i-carbon-chevron-down absolute inset-ie-2 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>

    <!-- package list -->
    <div class="flex flex-col -mx-3">
      <div
        v-for="pkg in filteredAndSorted"
        :key="pkg.name"
        class="group flex gap-4 rounded-lg border border-transparent px-3 py-4 transition-colors duration-200 hover:border-border hover:bg-bg-subtle"
      >
        <!-- left side: percentage and size -->
        <div class="flex w-16 shrink-0 flex-col items-end text-right">
          <span class="font-semibold text-fg"
            >{{ ((pkg.size / displayInstallSize) * 100).toFixed(0) }}%</span
          >
          <span class="text-sm text-fg-muted">{{ formatBytes(pkg.size) }}</span>
        </div>

        <!-- main content -->
        <div class="flex min-w-0 flex-1 flex-col gap-1.5">
          <!-- name, version, and level -->
          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              :to="`/${pkg.name}`"
              class="font-mono text-sm font-semibold text-fg hover:text-accent-muted transition-colors duration-200"
            >
              {{ pkg.name }}
            </NuxtLink>
            <span class="text-sm text-fg-muted">{{ pkg.version }}</span>
            <span
              v-if="pkg.level > 0"
              class="rounded-md bg-bg-muted px-1.5 py-0.5 text-xs font-medium text-fg-subtle"
            >
              {{ $t('impact.level', { level: pkg.level }) }}
            </span>
          </div>

          <!-- stats -->
          <div class="flex flex-wrap gap-4 text-sm">
            <span class="text-fg-muted">
              <span class="font-medium text-fg-subtle">{{ $t('impact.installed_by') }}:</span>
              {{ pkg.dependents.length }}
            </span>
            <span class="text-fg-muted">
              <span class="font-medium text-fg-subtle">{{ $t('impact.dependencies_count') }}:</span>
              {{ pkg.dependencies.length }}
            </span>
          </div>
        </div>
      </div>

      <!-- empty state -->
      <div
        v-if="filteredAndSorted.length === 0"
        class="py-12 text-center text-fg-subtle font-mono text-sm"
      >
        {{ $t('impact.no_packages_match') }}
      </div>
    </div>
  </div>
</template>
