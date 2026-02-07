<script setup lang="ts">
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, lightenOklch } from '~/utils/colors'

const props = defineProps<{
  packageName: string
  createdIso: string | null
}>()

const chartModal = useModal('chart-modal')
const hasChartModalTransitioned = shallowRef(false)
const isChartModalOpen = shallowRef(false)

async function openChartModal() {
  isChartModalOpen.value = true
  hasChartModalTransitioned.value = false
  // ensure the component renders before opening the dialog
  await nextTick()
  await nextTick()
  chartModal.open()
}

function handleModalClose() {
  isChartModalOpen.value = false
  hasChartModalTransitioned.value = false
}

function handleModalTransitioned() {
  hasChartModalTransitioned.value = true
}

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
  for (const item of accentColors.value) {
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
      () => props.createdIso,
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
          show: true, // the pulse will not show if prefers-reduced-motion (enforced by vue-data-ui)
          loop: true, // runs only once if false
          radius: 1.5,
          color: pulseColor.value,
          easing: 'ease-in-out',
          trail: {
            show: true,
            length: 20,
            opacity: 0.75,
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
        <ButtonBase
          type="button"
          @click="openChartModal"
          class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 focus-visible:outline-accent/70 rounded"
          :title="$t('package.downloads.analyze')"
          classicon="i-carbon:data-analytics"
        >
          <span class="sr-only">{{ $t('package.downloads.analyze') }}</span>
        </ButtonBase>
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
                <SkeletonInline class="h-3 w-36" />
              </div>
              <!-- Chart area: data label left, sparkline right -->
              <div class="aspect-[500/80] flex items-center">
                <!-- Data label (covers ~42% width) -->
                <div class="w-[42%] flex items-center ps-0.5">
                  <SkeletonInline class="h-7 w-24" />
                </div>
                <!-- Sparkline area (~58% width) -->
                <div class="flex-1 flex items-end gap-0.5 h-4/5 pe-3">
                  <SkeletonInline
                    v-for="i in 16"
                    :key="i"
                    class="flex-1 rounded-sm"
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

  <PackageChartModal @close="handleModalClose" @transitioned="handleModalTransitioned">
    <!-- The Chart is mounted after the dialog has transitioned -->
    <!-- This avoids flaky behavior that hides the chart's minimap half of the time -->
    <Transition name="opacity" mode="out-in">
      <PackageDownloadAnalytics
        v-if="hasChartModalTransitioned"
        :weeklyDownloads="weeklyDownloads"
        :inModal="true"
        :packageName="props.packageName"
        :createdIso="createdIso"
      />
    </Transition>

    <!-- This placeholder bears the same dimensions as the PackageDownloadAnalytics component -->
    <!-- Avoids CLS when the dialog has transitioned -->
    <div
      v-if="!hasChartModalTransitioned"
      class="w-full aspect-[390/634.5] sm:aspect-[718/622.797]"
    />
  </PackageChartModal>
</template>

<style scoped>
.opacity-enter-active,
.opacity-leave-active {
  transition: opacity 200ms ease;
}

.opacity-enter-from,
.opacity-leave-to {
  opacity: 0;
}

.opacity-enter-to,
.opacity-leave-from {
  opacity: 1;
}
</style>

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
