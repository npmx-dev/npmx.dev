<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'

const { packageName } = defineProps<{
  packageName: string
}>()

const showModal = ref(false)

const { data: packument } = usePackage(() => packageName)
const createdIso = computed(() => packument.value?.time?.created ?? null)

const { fetchPackageDownloadEvolution } = useCharts()

const { accentColors, selectedAccentColor } = useAccentColor()

const colorMode = useColorMode()

const resolvedMode = ref<'light' | 'dark'>('light')

onMounted(() => {
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync' },
)

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const accentColorValueById = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const item of accentColors) {
    map[item.id] = item.value
  }
  return map
})

const accent = computed(() => {
  const id = selectedAccentColor.value
  return id ? (oklchToHex(accentColorValueById.value[id]!) ?? '#8A8A8A') : '#8A8A8A'
})

const pulseColor = computed(() => {
  if (!selectedAccentColor.value) {
    return isDarkMode.value ? '#BFBFBF' : '#E0E0E0'
  }
  return isDarkMode.value ? accent.value : lightenHex(accent.value, 0.5)
})

const weeklyDownloads = ref<WeeklyDownloadPoint[]>([])

async function loadWeeklyDownloads() {
  if (!import.meta.client) return

  try {
    const result = await fetchPackageDownloadEvolution(
      () => packageName,
      () => createdIso.value,
      () => ({ granularity: 'week' as const, weeks: 52 }),
    )
    weeklyDownloads.value = (result as WeeklyDownloadPoint[]) ?? []
  } catch {
    weeklyDownloads.value = []
  }
}

onMounted(() => {
  loadWeeklyDownloads()
})

watch(
  () => packageName,
  () => loadWeeklyDownloads(),
)

const dataset = computed(() =>
  weeklyDownloads.value.map(d => ({
    value: d?.downloads ?? 0,
    period: $t('package.downloads.date_range', {
      start: d.weekStart ?? '-',
      end: d.weekEnd ?? '-',
    }),
  })),
)

const lastDatapoint = computed(() => dataset.value.at(-1)?.period ?? '')

// oklh or css variables are not supported by vue-data-ui (for now)
const config = computed(() => {
  return {
    theme: 'dark',
    style: {
      backgroundColor: 'transparent',
      animation: { show: false },
      area: {
        color: '#6A6A6A',
        useGradient: false,
        opacity: 10,
      },
      dataLabel: {
        offsetX: -10,
        fontSize: 28,
        bold: false,
        color: isDarkMode.value ? '#8a8a8a' : '#696969',
      },
      line: {
        color: isDarkMode.value ? '#4a4a4a' : '#525252',
        pulse: {
          show: true,
          loop: true, // runs only once if false
          radius: 2,
          color: pulseColor.value,
          easing: 'ease-in-out',
          trail: {
            show: true,
            length: 6,
          },
        },
      },
      plot: {
        radius: 6,
        stroke: isDarkMode.value ? '#FAFAFA' : '#0A0A0A',
      },
      title: {
        text: lastDatapoint.value,
        fontSize: 12,
        color: isDarkMode.value ? '#8a8a8a' : '#696969',
        bold: false,
      },
      verticalIndicator: {
        strokeDasharray: 0,
        color: isDarkMode.value ? '#FAFAFA' : '#525252',
      },
    },
  }
})
</script>

<template>
  <div class="space-y-8">
    <section id="downloads" class="scroll-mt-20">
      <div class="flex items-center justify-between mb-3">
        <h2 class="group text-xs text-fg-subtle uppercase tracking-wider">
          <a
            href="#downloads"
            class="inline-flex items-center gap-1.5 text-fg-subtle hover:text-fg-muted transition-colors duration-200 no-underline"
          >
            {{ $t('package.downloads.title') }}
            <span
              class="i-carbon-link w-3 h-3 block opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              aria-hidden="true"
            />
          </a>
        </h2>
        <button
          type="button"
          @click="showModal = true"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5 ml-auto shrink-0 self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
          :title="$t('package.downloads.analyze')"
        >
          <span class="i-carbon-data-analytics w-4 h-4" aria-hidden="true" />
          <span class="sr-only">{{ $t('package.downloads.analyze') }}</span>
        </button>
      </div>

      <div class="w-full overflow-hidden">
        <ClientOnly>
          <VueUiSparkline class="w-full max-w-xs" :dataset :config />
          <template #fallback>
            <!-- Skeleton matching sparkline layout: title row + chart with data label -->
            <div class="min-h-[100px]">
              <!-- Title row: date range (24px height) -->
              <div class="h-6 flex items-center pl-3">
                <span class="skeleton h-3 w-36" />
              </div>
              <!-- Chart area: data label left, sparkline right -->
              <div class="aspect-[500/80] flex items-center">
                <!-- Data label (covers ~42% width) -->
                <div class="w-[42%] flex items-center pl-0.5">
                  <span class="skeleton h-7 w-24" />
                </div>
                <!-- Sparkline area (~58% width) -->
                <div class="flex-1 flex items-end gap-0.5 h-4/5 pr-3">
                  <span
                    v-for="i in 16"
                    :key="i"
                    class="skeleton flex-1 rounded-sm"
                    :style="{ height: `${25 + ((i * 7) % 50)}%` }"
                  />
                </div>
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </section>
  </div>

  <ChartModal v-model:open="showModal">
    <template #title>{{ $t('package.downloads.modal_title') }}</template>

    <PackageDownloadAnalytics
      :weeklyDownloads="weeklyDownloads"
      :inModal="true"
      :packageName="packageName"
      :createdIso="createdIso"
    />

    <template #after="{ close }">
      <div class="sm:hidden flex justify-center">
        <button
          type="button"
          @click="close"
          class="w-12 h-12 bg-bg-elevated border border-border rounded-full shadow-lg flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
          :aria-label="$t('common.close')"
        >
          <span class="w-5 h-5 i-carbon-close" aria-hidden="true" />
        </button>
      </div>
    </template>
  </ChartModal>
</template>

<style>
/** Overrides */
.vue-ui-sparkline-title span {
  padding: 0 !important;
  letter-spacing: 0.04rem;
}
.vue-ui-sparkline text {
  font-family:
    Geist Mono,
    monospace !important;
}
</style>
