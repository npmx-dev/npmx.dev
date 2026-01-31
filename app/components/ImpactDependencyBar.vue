<script setup lang="ts">
import type { InstalledPackage } from '~/bundler/types'

const props = defineProps<{
  packages: InstalledPackage[]
  installSize: number
}>()

/** colors for the size breakdown bar segments */
const SEGMENT_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-pink-500',
]

/**
 * cyrb53 hash - fast 53-bit hash with good distribution.
 * @see https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/** derives a consistent color index from a package name */
function getCanonicalColorIndex(name: string): number {
  return cyrb53(name) % SEGMENT_COLORS.length
}

/** threshold above which we use greedy instead of DP (for performance) */
const COLOR_RESOLUTION_DP_LIMIT = 2000

/**
 * resolves adjacent color collisions with globally minimal adjustments.
 * uses dynamic programming to find the assignment that changes the fewest segments
 * from their canonical (hash-based) colors while ensuring no adjacent segments share a color.
 * falls back to greedy for very large inputs.
 */
function resolveColorCollisions(canonicalIndices: number[]): number[] {
  const numSegments = canonicalIndices.length
  const numColors = SEGMENT_COLORS.length

  if (numSegments === 0) return []
  if (numSegments === 1) return [canonicalIndices[0]!]

  // fall back to greedy for very large inputs
  if (numSegments > COLOR_RESOLUTION_DP_LIMIT) {
    const resolved: number[] = [canonicalIndices[0]!]
    for (let i = 1; i < numSegments; i++) {
      const canonical = canonicalIndices[i]!
      resolved.push(canonical === resolved[i - 1] ? (canonical + 1) % numColors : canonical)
    }
    return resolved
  }

  // dp[c] = min cost to reach current position with color c
  let prev = Array.from({ length: numColors }, () => 0)
  let curr = Array.from({ length: numColors }, () => 0)

  // parent[i][c] = color of position i that led to optimal assignment at position i+1 with color c
  const parent: number[][] = []

  // base case: position 0
  for (let c = 0; c < numColors; c++) {
    prev[c] = c === canonicalIndices[0]! ? 0 : 1
  }

  // fill DP table
  for (let i = 1; i < numSegments; i++) {
    const canonical = canonicalIndices[i]!
    const parentRow = Array.from({ length: numColors }, () => 0)

    for (let c = 0; c < numColors; c++) {
      const cost = c === canonical ? 0 : 1

      // find best previous color that isn't c
      let bestPrevCost = Infinity
      let bestPrevColor = 0
      for (let cp = 0; cp < numColors; cp++) {
        if (cp !== c && prev[cp]! < bestPrevCost) {
          bestPrevCost = prev[cp]!
          bestPrevColor = cp
        }
      }

      curr[c]! = cost + bestPrevCost
      parentRow[c]! = bestPrevColor
    }

    parent.push(parentRow)
    ;[prev, curr] = [curr, prev]
  }

  // find best final color
  let bestFinal = 0
  for (let c = 1; c < numColors; c++) {
    if (prev[c]! < prev[bestFinal]!) {
      bestFinal = c
    }
  }

  // backtrack to build result (build reversed, then flip)
  let color = bestFinal
  const reversed = [color]
  for (let i = parent.length - 1; i >= 0; i--) {
    color = parent[i]![color]!
    reversed.push(color)
  }
  return reversed.toReversed()
}

const segments = computed(() => {
  // sort by size descending for the bar
  const sorted = [...props.packages].toSorted((a, b) => b.size - a.size)

  // compute canonical colors, then resolve adjacent collisions
  const canonicalIndices = sorted.map(pkg => getCanonicalColorIndex(pkg.name))
  const resolvedIndices = resolveColorCollisions(canonicalIndices)

  return sorted.map((pkg, i) => ({
    pkg,
    percent: (pkg.size / props.installSize) * 100,
    color: SEGMENT_COLORS[resolvedIndices[i]!]!,
  }))
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Tooltip state
const hoveredSegment = ref<(typeof segments.value)[number] | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

function handleMouseEnter(segment: (typeof segments.value)[number], event: MouseEvent) {
  hoveredSegment.value = segment
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
}

function handleMouseMove(event: MouseEvent) {
  tooltipPosition.value = { x: event.clientX, y: event.clientY }
}

function handleMouseLeave() {
  hoveredSegment.value = null
}
</script>

<template>
  <div class="flex h-8 w-full overflow-hidden rounded-lg bg-bg-subtle">
    <div
      v-for="segment in segments"
      :key="segment.pkg.name"
      :class="segment.color"
      class="h-full min-w-0 transition-opacity duration-200 hover:opacity-80 cursor-pointer"
      :style="{ width: `${segment.percent}%` }"
      @mouseenter="handleMouseEnter(segment, $event)"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
    />
  </div>

  <!-- Tooltip -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="hoveredSegment"
        class="fixed z-50 px-2 py-1 font-mono text-xs text-fg bg-bg-elevated border border-border rounded shadow-lg whitespace-nowrap pointer-events-none"
        :style="{
          left: `${tooltipPosition.x + 12}px`,
          top: `${tooltipPosition.y + 12}px`,
        }"
      >
        <span class="font-medium">{{ hoveredSegment.pkg.name }}</span>
        <span class="text-fg-muted">
          — {{ formatBytes(hoveredSegment.pkg.size) }} ({{ hoveredSegment.percent.toFixed(1) }}%)
        </span>
      </div>
    </Transition>
  </Teleport>
</template>
