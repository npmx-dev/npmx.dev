<script setup lang="ts">
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'

const props = defineProps<{
  downloads?: Array<{
    downloads: number | null
    weekStart: string
    weekEnd: string
  }>
}>()

const dataset = computed(() =>
  props.downloads?.map(d => ({
    value: d?.downloads ?? 0,
    period: `${d.weekStart ?? '-'} to ${d.weekEnd ?? '-'}`,
  })),
)

const lastDatapoint = computed(() => {
  return (dataset.value || []).at(-1)?.period ?? ''
})

const config = computed(() => ({
  theme: 'dark', // enforced dark mode for now
  style: {
    backgroundColor: 'transparent',
    animation: {
      show: false,
    },
    area: {
      color: '#6A6A6A',
      useGradient: false,
      opacity: 10,
    },
    dataLabel: {
      offsetX: -10,
      fontSize: 28,
      bold: false,
      color: '#FAFAFA',
    },
    line: {
      color: '#6A6A6A',
      pulse: {
        show: true,
        loop: true, // runs only once if false
        radius: 2,
        color: '#8A8A8A',
        easing: 'ease-in-out',
        trail: {
          show: true,
          length: 6,
        },
      },
    },
    plot: {
      radius: 6,
      stroke: '#FAFAFA',
    },
    title: {
      text: lastDatapoint.value,
      fontSize: 12,
      color: '#666666',
      bold: false,
    },
    verticalIndicator: {
      strokeDasharray: 0,
      color: '#FAFAFA',
    },
  },
}))
</script>

<template>
  <div class="space-y-8">
    <!-- Download stats -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">Weekly Downloads</h2>
      </div>
      <div class="w-full overflow-hidden">
        <ClientOnly>
          <VueUiSparkline class="max-w-full" :dataset :config />
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
.vue-ui-sparkline,
.vue-ui-sparkline svg {
  max-width: 100% !important;
}
</style>
