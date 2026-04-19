<script setup lang="ts">
import { encodePackageName } from '#shared/utils/npm'

const { packages = [], emptyDescription = 'Compare npm packages side-by-side' } = defineProps<{
  packages?: string | string[]
  emptyDescription?: string
}>()

const ACCENT_COLORS = [
  '#60a5fa',
  '#f472b6',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#fb923c',
  '#22d3ee',
  '#e879f9',
  '#4ade80',
  '#f87171',
  '#38bdf8',
  '#facc15',
]

// Tier thresholds
const FULL_MAX = 4
const COMPACT_MAX = 6
const GRID_MAX = 12
const SUMMARY_TOP_COUNT = 3

const displayPackages = computed(() => {
  const raw = packages
  return (typeof raw === 'string' ? raw.split(',') : raw).map(p => p.trim()).filter(Boolean)
})

type LayoutTier = 'full' | 'compact' | 'grid' | 'summary'
const layoutTier = computed<LayoutTier>(() => {
  const count = displayPackages.value.length
  if (count <= FULL_MAX) return 'full'
  if (count <= COMPACT_MAX) return 'compact'
  if (count <= GRID_MAX) return 'grid'
  return 'summary'
})

interface PkgStats {
  name: string
  downloads: number
  version: string
  color: string
}

const stats = shallowRef<PkgStats[]>([])

const FETCH_TIMEOUT_MS = 2500

if (layoutTier.value !== 'summary') {
  try {
    const results = await Promise.all(
      displayPackages.value.map(async (name, index) => {
        const encoded = encodePackageName(name)
        const [dlData, pkgData] = await Promise.all([
          $fetch<{ downloads: number }>(
            `https://api.npmjs.org/downloads/point/last-week/${encoded}`,
            { timeout: FETCH_TIMEOUT_MS },
          ).catch(() => null),
          $fetch<{ 'dist-tags'?: { latest?: string } }>(`https://registry.npmjs.org/${encoded}`, {
            timeout: FETCH_TIMEOUT_MS,
            headers: { Accept: 'application/vnd.npm.install-v1+json' },
          }).catch(() => null),
        ])
        return {
          name,
          downloads: dlData?.downloads ?? 0,
          version: pkgData?.['dist-tags']?.latest ?? '',
          color: ACCENT_COLORS[index % ACCENT_COLORS.length]!,
        }
      }),
    )
    // Sort by downloads descending for readability
    stats.value = results.sort((a, b) => b.downloads - a.downloads)
  } catch {
    stats.value = displayPackages.value.map((name, index) => ({
      name,
      downloads: 0,
      version: '',
      color: ACCENT_COLORS[index % ACCENT_COLORS.length]!,
    }))
  }
}

const maxDownloads = computed(() => Math.max(...stats.value.map(s => s.downloads), 1))

function formatDownloads(n: number): string {
  if (n === 0) return '—'
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

const BAR_MIN_PCT = 5
const BAR_MAX_PCT = 100

function barPct(downloads: number): string {
  if (downloads <= 0) return '0%'
  const pct = (downloads / maxDownloads.value) * 100
  return `${Math.min(BAR_MAX_PCT, Math.max(pct, BAR_MIN_PCT))}%`
}

const summaryTopNames = computed(() => displayPackages.value.slice(0, SUMMARY_TOP_COUNT))
const summaryRemainder = computed(() =>
  Math.max(0, displayPackages.value.length - SUMMARY_TOP_COUNT),
)
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex flex-col justify-center gap-10 h-full">
      <OgBrand :height="48" />

      <div class="flex items-baseline gap-3">
        <h1 class="text-7xl font-mono tracking-tighter leading-none">
          <span class="opacity-50">./</span>compare
        </h1>
      </div>

      <!-- Empty state -->
      <div v-if="displayPackages.length === 0" class="text-4xl text-fg-muted">
        {{ emptyDescription }}
      </div>

      <!-- FULL layout (1-4 packages): name + downloads + version badge + bar -->
      <div v-else-if="layoutTier === 'full'" class="flex flex-col gap-2">
        <div v-for="pkg in stats" :key="pkg.name" class="flex flex-col gap-1">
          <div class="flex items-center gap-3">
            <span
              class="text-2xl font-semibold tracking-tight font-mono"
              :style="{
                color: pkg.color,
                maxWidth: '400px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }"
            >
              {{ pkg.name }}
            </span>
            <span
              v-if="pkg.version"
              class="text-lg px-2 py-0.5 rounded-md border font-mono"
              :style="{
                color: pkg.color,
                backgroundColor: pkg.color + '10',
                borderColor: pkg.color + '30',
              }"
            >
              {{ pkg.version }}
            </span>
            <span class="text-3xl font-bold text-fg">
              {{ formatDownloads(pkg.downloads) }}/wk
            </span>
          </div>
          <div
            class="h-6 rounded-md"
            :style="{
              width: barPct(pkg.downloads),
              background: `linear-gradient(90deg, ${pkg.color}50, ${pkg.color}20)`,
            }"
          />
        </div>
      </div>

      <!-- COMPACT layout (5-6 packages): name + downloads + thinner bar, no version -->
      <div v-else-if="layoutTier === 'compact'" class="flex flex-col gap-2">
        <div v-for="pkg in stats" :key="pkg.name" class="flex flex-col gap-0.5">
          <div class="flex items-center gap-2">
            <span
              class="text-xl font-semibold tracking-tight font-mono"
              :style="{
                color: pkg.color,
                maxWidth: '300px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }"
            >
              {{ pkg.name }}
            </span>
            <span
              v-if="pkg.version"
              class="text-sm px-1.5 py-0.5 rounded border font-mono"
              :style="{
                color: pkg.color,
                backgroundColor: pkg.color + '10',
                borderColor: pkg.color + '30',
              }"
            >
              {{ pkg.version }}
            </span>
            <span class="text-xl font-bold text-fg"> {{ formatDownloads(pkg.downloads) }}/wk </span>
          </div>
          <div
            class="h-3 rounded-sm"
            :style="{
              width: barPct(pkg.downloads),
              background: `linear-gradient(90deg, ${pkg.color}50, ${pkg.color}20)`,
            }"
          />
        </div>
      </div>

      <!-- GRID layout (7-12 packages): flex-wrap grid -->
      <div
        v-else-if="layoutTier === 'grid'"
        :style="{
          display: 'flex',
          flexWrap: 'wrap',
          rowGap: 24,
          columnGap: 40,
        }"
      >
        <span
          v-for="pkg in stats"
          :key="pkg.name"
          :style="{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            width: '220px',
          }"
        >
          <span
            class="font-semibold tracking-tight font-mono"
            :style="{
              fontSize: '18px',
              maxWidth: '220px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: pkg.color,
            }"
            >{{ pkg.name }}</span
          >
          <span :style="{ display: 'flex', alignItems: 'baseline', gap: 2 }">
            <span class="text-2xl font-bold text-fg">{{ formatDownloads(pkg.downloads) }}</span>
            <span class="text-sm font-medium text-fg-muted">/wk</span>
          </span>
        </span>
      </div>

      <!-- SUMMARY layout (13+ packages): package count + top names -->
      <div v-else class="flex flex-col gap-3">
        <div class="text-2xl text-fg-muted">
          <span class="text-4xl font-bold text-fg">{{ displayPackages.length }}</span>
          packages
        </div>
        <div :style="{ display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }">
          <span
            v-for="(name, i) in summaryTopNames"
            :key="name"
            class="text-xl font-semibold font-mono"
            :style="{
              color: ACCENT_COLORS[i % ACCENT_COLORS.length],
              maxWidth: '280px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flexShrink: 1,
            }"
            >{{ name }}{{ i < summaryTopNames.length - 1 ? ',' : '' }}</span
          >
          <span v-if="summaryRemainder > 0" class="text-xl text-fg-subtle">
            +{{ summaryRemainder }} more
          </span>
        </div>
      </div>
    </div>
  </OgLayout>
</template>
