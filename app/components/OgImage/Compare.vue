<script setup lang="ts">
import { computed, ref } from 'vue'
import { encodePackageName } from '#shared/utils/npm'

const props = withDefaults(
  defineProps<{
    packages?: string | string[]
    emptyDescription?: string
    primaryColor?: string
  }>(),
  {
    packages: () => [],
    emptyDescription: 'Compare npm packages side-by-side',
    primaryColor: '#60a5fa',
  },
)

const ACCENT_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24']

const displayPackages = computed(() => {
  const raw = props.packages
  const list =
    typeof raw === 'string'
      ? raw
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
      : raw
  return list.slice(0, 4)
})

interface PkgStats {
  name: string
  downloads: number
  version: string
  color: string
}

const stats = ref<PkgStats[]>([])

try {
  const results = await Promise.all(
    displayPackages.value.map(async (name, index) => {
      const encoded = encodePackageName(name)
      const [dlData, pkgData] = await Promise.all([
        $fetch<{ downloads: number }>(
          `https://api.npmjs.org/downloads/point/last-week/${encoded}`,
        ).catch(() => null),
        $fetch<{ 'dist-tags'?: { latest?: string } }>(`https://registry.npmjs.org/${encoded}`, {
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
  stats.value = results
} catch {
  stats.value = displayPackages.value.map((name, index) => ({
    name,
    downloads: 0,
    version: '',
    color: ACCENT_COLORS[index % ACCENT_COLORS.length]!,
  }))
}

const maxDownloads = computed(() => Math.max(...stats.value.map(s => s.downloads), 1))

function formatDownloads(n: number): string {
  if (n === 0) return '—'
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}

// Bar width as percentage string (max 100%)
function barPct(downloads: number): string {
  const pct = (downloads / maxDownloads.value) * 100
  return `${Math.max(pct, 5)}%`
}
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
    style="font-family: 'Geist Mono', sans-serif"
  >
    <div class="relative z-10 flex flex-col gap-5">
      <!-- Icon + title row -->
      <div class="flex items-start gap-4">
        <div
          class="flex items-center justify-center w-14 h-14 p-3 rounded-xl shadow-lg bg-gradient-to-tr from-[#3b82f6]"
          :style="{ backgroundColor: primaryColor }"
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M11 18H8a2 2 0 0 1-2-2V9" />
          </svg>
        </div>

        <h1 class="text-7xl font-bold tracking-tight">
          <span
            class="opacity-80 tracking-[-0.1em]"
            :style="{ color: primaryColor }"
            style="margin-right: 0.25rem"
            >./</span
          >compare
        </h1>
      </div>

      <!-- Empty state -->
      <div
        v-if="stats.length === 0"
        class="text-4xl text-[#a3a3a3]"
        style="font-family: 'Geist', sans-serif"
      >
        {{ emptyDescription }}
      </div>

      <!-- Bar chart rows -->
      <div v-else class="flex flex-col gap-2">
        <div v-for="pkg in stats" :key="pkg.name" class="flex flex-col gap-1">
          <!-- Label row: name + downloads + version -->
          <div class="flex items-center gap-3" style="font-family: 'Geist', sans-serif">
            <span class="text-2xl font-semibold tracking-tight" :style="{ color: pkg.color }">
              {{ pkg.name }}
            </span>
            <span class="text-2xl font-medium text-[#d4d4d4]">
              {{ formatDownloads(pkg.downloads) }}/wk
            </span>
            <span
              v-if="pkg.version"
              class="text-lg px-2 py-0.5 rounded-md border"
              :style="{
                color: pkg.color,
                backgroundColor: pkg.color + '10',
                borderColor: pkg.color + '30',
              }"
            >
              {{ pkg.version }}
            </span>
          </div>

          <!-- Bar -->
          <div
            class="h-6 rounded-md"
            :style="{
              width: barPct(pkg.downloads),
              background: `linear-gradient(90deg, ${pkg.color}50, ${pkg.color}20)`,
            }"
          />
        </div>
      </div>
    </div>

    <div
      class="absolute -top-32 -inset-ie-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
