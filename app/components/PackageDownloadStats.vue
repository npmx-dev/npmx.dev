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
        <h2 id="dependencies-heading" class="text-xs text-fg-subtle uppercase tracking-wider">
          Weekly Downloads
        </h2>
      </div>
      <div class="w-full">
        <ClientOnly>
          <VueUiSparkline :dataset :config />
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
</style>
