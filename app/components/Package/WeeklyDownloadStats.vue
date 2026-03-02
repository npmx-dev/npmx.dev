<script setup lang="ts">
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'
import { useCssVariables } from '~/composables/useColors'
import type { WeeklyDataPoint } from '~/types/chart'
import { applyDataCorrection } from '~/utils/chart-data-correction'
import { OKLCH_NEUTRAL_FALLBACK, lightenOklch } from '~/utils/colors'
import { applyBlocklistCorrection } from '~/utils/download-anomalies'
import type { RepoRef } from '#shared/utils/git-providers'
import type { VueUiSparklineConfig, VueUiSparklineDatasetItem } from 'vue-data-ui'

const props = defineProps<{
  packageName: string
  createdIso: string | null
  repoRef?: RepoRef | null | undefined
}>()

const router = useRouter()
const route = useRoute()
const { localSettings } = useUserLocalSettings()

const chartModal = useModal('chart-modal')
const hasChartModalTransitioned = shallowRef(false)

const modalTitle = computed(() => {
  const facet = route.query.facet as string | undefined
  if (facet === 'likes') return $t('package.trends.items.likes')
  if (facet === 'contributors') return $t('package.trends.items.contributors')
  return $t('package.trends.items.downloads')
})

const modalSubtitle = computed(() => {
  const facet = route.query.facet as string | undefined
  if (facet === 'likes' || facet === 'contributors') return undefined
  return $t('package.downloads.subtitle')
})

const isChartModalOpen = shallowRef<boolean>(false)

function handleModalClose() {
  isChartModalOpen.value = false
  hasChartModalTransitioned.value = false

  router.replace({
    query: {
      ...route.query,
      modal: undefined,
      granularity: undefined,
      end: undefined,
      start: undefined,
      facet: undefined,
    },
  })
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

function toggleSparklineAnimation() {
  localSettings.value.sidebar.animateSparkline = !localSettings.value.sidebar.animateSparkline
}

const hasSparklineAnimation = computed(() => localSettings.value.sidebar.animateSparkline)

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

const weeklyDownloads = shallowRef<WeeklyDataPoint[]>([])
const isLoadingWeeklyDownloads = shallowRef(true)
const hasWeeklyDownloads = computed(() => weeklyDownloads.value.length > 0)

async function openChartModal() {
  if (!hasWeeklyDownloads.value) return

  isChartModalOpen.value = true
  hasChartModalTransitioned.value = false

  await router.replace({
    query: {
      ...route.query,
      modal: 'chart',
    },
  })

  // ensure the component renders before opening the dialog
  await nextTick()
  await nextTick()
  chartModal.open()
}

async function loadWeeklyDownloads() {
  if (!import.meta.client) return

  isLoadingWeeklyDownloads.value = true
  try {
    const result = await fetchPackageDownloadEvolution(
      () => props.packageName,
      () => props.createdIso,
      () => ({ granularity: 'week' as const, weeks: 52 }),
    )
    weeklyDownloads.value = (result as WeeklyDataPoint[]) ?? []
  } catch {
    weeklyDownloads.value = []
  } finally {
    isLoadingWeeklyDownloads.value = false
  }
}

onMounted(async () => {
  await loadWeeklyDownloads()

  if (route.query.modal === 'chart') {
    isChartModalOpen.value = true
  }

  if (isChartModalOpen.value && hasWeeklyDownloads.value) {
    openChartModal()
  }
})

watch(
  () => props.packageName,
  () => loadWeeklyDownloads(),
)

const correctedDownloads = computed<WeeklyDataPoint[]>(() => {
  let data = weeklyDownloads.value as WeeklyDataPoint[]
  if (!data.length) return data
  if (localSettings.value.chartFilter.anomaliesFixed) {
    data = applyBlocklistCorrection({
      data,
      packageName: props.packageName,
      granularity: 'weekly',
    }) as WeeklyDataPoint[]
  }
  data = applyDataCorrection(data, localSettings.value.chartFilter) as WeeklyDataPoint[]
  return data
})

const dataset = computed<VueUiSparklineDatasetItem[]>(() =>
  correctedDownloads.value.map(d => ({
    value: d?.value ?? 0,
    period: $t('package.trends.date_range', {
      start: d.weekStart ?? '-',
      end: d.weekEnd ?? '-',
    }),
  })),
)

const lastDatapoint = computed(() => dataset.value.at(-1)?.period ?? '')

const config = computed<VueUiSparklineConfig>(() => {
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
          show: hasSparklineAnimation.value, // the pulse will not show if prefers-reduced-motion (enforced by vue-data-ui)
          loop: true, // runs only once if false
          radius: 1.5,
          color: pulseColor.value!,
          easing: 'ease-in-out',
          trail: {
            show: true,
            length: 30,
            opacity: 0.75,
          },
        },
      },
      plot: {
        radius: 6,
        stroke: isDarkMode.value ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)',
      },
      title: {
        text: String(lastDatapoint.value),
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
    <CollapsibleSection
      id="downloads"
      :title="$t('package.downloads.title')"
      :subtitle="$t('package.downloads.subtitle')"
    >
      <template #actions>
        <ButtonBase
          v-if="hasWeeklyDownloads"
          type="button"
          @click="openChartModal"
          class="text-fg-subtle hover:text-fg transition-colors duration-200 inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 focus-visible:outline-accent/70 rounded"
          :title="$t('package.trends.title')"
          classicon="i-lucide:chart-line"
        >
          <span class="sr-only">{{ $t('package.trends.title') }}</span>
        </ButtonBase>
        <span v-else-if="isLoadingWeeklyDownloads" class="min-w-6 min-h-6 -m-1 p-1" />
      </template>

      <div class="w-full overflow-hidden h-[76px] motion-safe:h-[calc(92px+0.75rem)]">
        <template v-if="isLoadingWeeklyDownloads || hasWeeklyDownloads">
          <ClientOnly>
            <VueUiSparkline class="w-full max-w-xs" :dataset :config>
              <template #skeleton>
                <!-- This empty div overrides the default built-in scanning animation on load -->
                <div />
              </template>
            </VueUiSparkline>
            <template #fallback>
              <!-- Skeleton matching VueUiSparkline layout (title 24px + SVG aspect 500:80) -->
              <div class="max-w-xs">
                <!-- Title row: fontSize * 2 = 24px -->
                <div class="h-6 flex items-center ps-3">
                  <SkeletonInline class="h-3 w-36" />
                </div>
                <!-- Chart area: matches SVG viewBox 500:80 -->
                <div class="aspect-[500/80] flex items-center">
                  <!-- Data label (covers ~42% width, matching dataLabel.offsetX) -->
                  <div class="w-[42%] flex items-center ps-0.5">
                    <SkeletonInline class="h-7 w-24" />
                  </div>
                  <!-- Sparkline line placeholder -->
                  <div class="flex-1 flex items-end pe-3">
                    <SkeletonInline class="h-px w-full" />
                  </div>
                </div>
                <!-- Animation toggle placeholder -->
                <div class="w-full hidden motion-safe:flex flex-1 items-end justify-end">
                  <SkeletonInline class="h-[20px] w-30" />
                </div>
              </div>
            </template>
          </ClientOnly>

          <div v-if="hasWeeklyDownloads" class="hidden motion-safe:flex justify-end p-1">
            <ButtonBase size="small" @click="toggleSparklineAnimation">
              {{
                hasSparklineAnimation
                  ? $t('package.trends.pause_animation')
                  : $t('package.trends.play_animation')
              }}
            </ButtonBase>
          </div>
        </template>
        <p v-else class="py-2 text-sm font-mono text-fg-subtle">
          {{ $t('package.trends.no_data') }}
        </p>
      </div>
    </CollapsibleSection>
  </div>

  <PackageChartModal
    v-if="isChartModalOpen && hasWeeklyDownloads"
    :modal-title="modalTitle"
    :modal-subtitle="modalSubtitle"
    @close="handleModalClose"
    @transitioned="handleModalTransitioned"
  >
    <!-- The Chart is mounted after the dialog has transitioned -->
    <!-- This avoids flaky behavior that hides the chart's minimap half of the time -->
    <Transition name="opacity" mode="out-in">
      <PackageTrendsChart
        v-if="hasChartModalTransitioned"
        :weeklyDownloads="weeklyDownloads"
        :inModal="true"
        :packageName="props.packageName"
        :repoRef="props.repoRef"
        :createdIso="createdIso"
        permalink
        show-facet-selector
      />
    </Transition>

    <!-- This placeholder bears the same dimensions as the PackageTrendsChart component -->
    <!-- Avoids CLS when the dialog has transitioned -->
    <div v-if="!hasChartModalTransitioned" class="w-full aspect-[390/634.5] sm:aspect-[718/647]" />
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
  @apply font-mono;
}

.vue-ui-sparkline text {
  font-family:
    Geist Mono,
    monospace !important;
}
</style>
