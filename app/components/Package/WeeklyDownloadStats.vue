<script setup lang="ts">
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, lightenOklch } from '~/utils/colors'

const props = defineProps<{
  packageName: string
}>()

const chartModal = useModal('chart-modal')

const isChartModalOpen = shallowRef(false)
function openChartModal() {
  isChartModalOpen.value = true
  // ensure the component renders before opening the dialog
  nextTick(() => chartModal.open())
}

const { data: packument } = usePackage(() => props.packageName)
const createdIso = computed(() => packument.value?.time?.created ?? null)

const { fetchPackageDownloadEvolution } = useCharts()

const { accentColors, selectedAccentColor } = useAccentColor()

const colorMode = useColorMode()

const resolvedMode = shallowRef<'light' | 'dark'>('light')

const rootEl = shallowRef<HTMLElement | null>(null)

onMounted(() => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync' },
)

const { colors } = useCssVariables(
  [
    '--bg',
    '--fg',
    '--bg-subtle',
    '--bg-elevated',
    '--border-hover',
    '--fg-subtle',
    '--border',
    '--border-subtle',
  ],
  {
    element: rootEl,
    watchHtmlAttributes: true,
    watchResize: false, // set to true only if a var changes color on resize
  },
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
  return id
    ? (accentColorValueById.value[id] ?? colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK)
    : (colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK)
})

const pulseColor = computed(() => {
  if (!selectedAccentColor.value) {
    return colors.value.fgSubtle
  }
  return isDarkMode.value ? accent.value : lightenOklch(accent.value, 0.5)
})

const weeklyDownloads = shallowRef<WeeklyDownloadPoint[]>([])

async function loadWeeklyDownloads() {
  if (!import.meta.client) return

  try {
    const result = await fetchPackageDownloadEvolution(
      () => props.packageName,
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
  () => props.packageName,
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

const config = computed(() => {
  return {
    theme: 'dark',
    /**
     * The built-in skeleton loader kicks in when the component is mounted but the data is not yet ready.
     * The configuration of the skeleton is customized for a seemless transition with the final state
     */
    skeletonConfig: {
      style: {
        backgroundColor: 'transparent',
        dataLabel: {
          show: true,
          color: 'transparent',
        },
        area: {
          color: colors.value.borderHover,
          useGradient: false,
          opacity: 10,
        },
        line: {
          color: colors.value.borderHover,
        },
      },
    },
    // Same idea: initialize the line at zero, so it nicely transitions to the final dataset
    skeletonDataset: Array.from({ length: 52 }, () => 0),
    style: {
      backgroundColor: 'transparent',
      animation: { show: false },
      area: {
        color: colors.value.borderHover,
        useGradient: false,
        opacity: 10,
      },
      dataLabel: {
        offsetX: -10,
        fontSize: 28,
        bold: false,
        color: colors.value.fg,
      },
      line: {
        color: colors.value.borderHover,
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
        stroke: isDarkMode.value ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)',
      },
      title: {
        text: lastDatapoint.value,
        fontSize: 12,
        color: colors.value.fgSubtle,
        bold: false,
      },
      verticalIndicator: {
        strokeDasharray: 0,
        color: isDarkMode.value ? 'oklch(0.985 0 0)' : colors.value.fgSubtle,
      },
    },
  }
})
</script>

<template>
  <div class="space-y-8">
    <CollapsibleSection id="downloads" :title="$t('package.downloads.title')">
      <template #actions>
        <button
          type="button"
          @click="openChartModal"
          class="link-subtle font-mono text-sm inline-flex items-center gap-1.5 ms-auto shrink-0 self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
          :title="$t('package.downloads.analyze')"
        >
          <span class="i-carbon:data-analytics w-4 h-4" aria-hidden="true" />
          <span class="sr-only">{{ $t('package.downloads.analyze') }}</span>
        </button>
      </template>

      <div class="w-full overflow-hidden">
        <ClientOnly>
          <VueUiSparkline class="w-full max-w-xs" :dataset :config>
            <template #skeleton>
              <!-- This empty div overrides the default built-in scanning animation on load -->
              <div />
            </template>
          </VueUiSparkline>
          <template #fallback>
            <!-- Skeleton matching sparkline layout: title row + chart with data label -->
            <div class="min-h-[75.195px]">
              <!-- Title row: date range (24px height) -->
              <div class="h-6 flex items-center ps-3">
                <span class="skeleton h-3 w-36" />
              </div>
              <!-- Chart area: data label left, sparkline right -->
              <div class="aspect-[500/80] flex items-center">
                <!-- Data label (covers ~42% width) -->
                <div class="w-[42%] flex items-center ps-0.5">
                  <span class="skeleton h-7 w-24" />
                </div>
                <!-- Sparkline area (~58% width) -->
                <div class="flex-1 flex items-end gap-0.5 h-4/5 pe-3">
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
    </CollapsibleSection>
  </div>

  <PackageChartModal v-if="isChartModalOpen" @close="isChartModalOpen = false">
    <PackageDownloadAnalytics
      :weeklyDownloads="weeklyDownloads"
      :inModal="true"
      :packageName="props.packageName"
      :createdIso="createdIso"
    />
  </PackageChartModal>
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
