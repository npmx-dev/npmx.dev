<script setup lang="ts">
import { packageRoute } from '~/utils/router'

// Minimal interface for packages - we only need these fields
interface PackageInfo {
  name: string
  version: string
  size: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const props = defineProps<{
  packages: readonly PackageInfo[]
  packageName: string
}>()

// Sort packages by size descending, exclude the root package
const sortedPackages = computed(() => {
  return props.packages.filter(p => p.name !== props.packageName).sort((a, b) => b.size - a.size)
})

// Total size of all packages
const totalSize = computed(() => {
  return props.packages.reduce((sum, p) => sum + p.size, 0)
})

// Colors for the bar segments
const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-lime-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-yellow-500',
  'bg-red-500',
]

// Get color for a package (consistent based on name)
function getColor(packageName: string, _index: number): string {
  // Use a hash of the package name for consistent colors
  let hash = 0
  for (let i = 0; i < packageName.length; i++) {
    hash = (hash << 5) - hash + packageName.charCodeAt(i)
    hash |= 0
  }
  return COLORS[Math.abs(hash) % COLORS.length] ?? 'bg-gray-500'
}

// Get percentage width for a package
function getWidth(pkg: PackageInfo): string {
  if (totalSize.value === 0) return '0%'
  const percent = (pkg.size / totalSize.value) * 100
  return `${Math.max(percent, 0.5)}%` // Minimum 0.5% for visibility
}

// Hovered package for tooltip
const hoveredPackage = ref<PackageInfo | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

function handleMouseEnter(pkg: PackageInfo, event: MouseEvent) {
  hoveredPackage.value = pkg
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
}

function handleMouseMove(event: MouseEvent) {
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
}

function handleMouseLeave() {
  hoveredPackage.value = null
}

// Show top N packages in the list
const MAX_DISPLAY = 15
const displayPackages = computed(() => sortedPackages.value.slice(0, MAX_DISPLAY))
const remainingCount = computed(() => Math.max(0, sortedPackages.value.length - MAX_DISPLAY))
const remainingSize = computed(() => {
  return sortedPackages.value.slice(MAX_DISPLAY).reduce((sum, p) => sum + p.size, 0)
})
</script>

<template>
  <div class="space-y-4">
    <!-- Visual bar -->
    <div class="h-6 bg-bg-subtle rounded overflow-hidden flex">
      <div
        v-for="(pkg, index) in sortedPackages"
        :key="pkg.name"
        :class="getColor(pkg.name, index)"
        :style="{ width: getWidth(pkg) }"
        class="h-full transition-opacity hover:opacity-80 cursor-pointer"
        @mouseenter="handleMouseEnter(pkg, $event)"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      />
    </div>

    <!-- Package list -->
    <div class="space-y-2">
      <div v-for="(pkg, index) in displayPackages" :key="pkg.name" class="flex items-center gap-3">
        <div :class="getColor(pkg.name, index)" class="w-3 h-3 rounded-sm shrink-0" />
        <NuxtLink
          :to="packageRoute(pkg.name)"
          class="font-mono text-sm text-fg-muted hover:text-fg transition-colors truncate flex-1"
        >
          {{ pkg.name }}
        </NuxtLink>
        <span class="font-mono text-sm text-fg-subtle shrink-0">
          {{ formatBytes(pkg.size) }}
        </span>
        <span class="text-xs text-fg-subtle shrink-0">
          {{ totalSize > 0 ? ((pkg.size / totalSize) * 100).toFixed(1) : '0.0' }}%
        </span>
      </div>

      <!-- Remaining packages -->
      <div v-if="remainingCount > 0" class="flex items-center gap-3 text-fg-subtle">
        <div class="w-3 h-3 rounded-sm bg-bg-muted shrink-0" />
        <span class="text-sm flex-1">
          {{ $t('impact.and_more', { count: remainingCount }) }}
        </span>
        <span class="font-mono text-sm shrink-0">
          {{ formatBytes(remainingSize) }}
        </span>
      </div>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="hoveredPackage"
        class="fixed z-50 px-3 py-2 bg-bg border border-border rounded-lg shadow-lg pointer-events-none"
        :style="{
          left: `${tooltipPosition.x + 10}px`,
          top: `${tooltipPosition.y + 10}px`,
        }"
      >
        <div class="font-mono text-sm font-semibold text-fg">
          {{ hoveredPackage.name }}@{{ hoveredPackage.version }}
        </div>
        <div class="text-sm text-fg-muted mt-1">
          {{ formatBytes(hoveredPackage.size) }}
          <span class="text-fg-subtle">
            ({{ totalSize > 0 ? ((hoveredPackage.size / totalSize) * 100).toFixed(1) : '0.0' }}%)
          </span>
        </div>
      </div>
    </Teleport>
  </div>
</template>
