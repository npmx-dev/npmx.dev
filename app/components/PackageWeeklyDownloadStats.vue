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
    period: t('package.downloads.date_range', { start: d.weekStart ?? '-', end: d.weekEnd ?? '-' }),
  })),
)

const lastDatapoint = computed(() => dataset.value.at(-1)?.period ?? '')

const config = computed(() => ({
  theme: 'dark',
  style: {
    backgroundColor: 'transparent',
    animation: { show: false },
    area: { color: '#6A6A6A', useGradient: false, opacity: 10 },
    dataLabel: { offsetX: -10, fontSize: 28, bold: false, color: '#FAFAFA' },
    line: {
      color: '#6A6A6A',
      pulse: {
        show: true,
        loop: true,
        radius: 2,
        color: '#8A8A8A',
        easing: 'ease-in-out',
        trail: { show: true, length: 6 },
      },
    },
    plot: { radius: 6, stroke: '#FAFAFA' },
    title: { text: lastDatapoint.value, fontSize: 12, color: '#8A8A8A', bold: false },
    verticalIndicator: { strokeDasharray: 0, color: '#FAFAFA' },
  },
}))
</script>

<template>
  <div class="space-y-8">
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">
          {{ $t('package.downloads.title') }}
        </h2>
        <a
          @click="showModal = true"
          class="cursor-pointer link-subtle font-mono text-sm inline-flex items-center gap-1.5 ml-auto shrink-0 self-center"
          title="Analyze downloads"
        >
          <span class="i-carbon-data-analytics w-4 h-4" />
        </a>
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
    <template #title>Downloads</template>

    <PackageDownloadAnalytics
      :weeklyDownloads="weeklyDownloads"
      :inModal="true"
      :packageName="packageName"
      :createdIso="createdIso"
    />
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
