<script setup lang="ts">
const props = defineProps<{
  downloads?: Array<{
    downloads: number
    weekStart: string
    weekEnd: string
  }>
}>()

const dataset = computed(
  () =>
    props.downloads?.map(({ downloads, weekStart, weekEnd }) => ({
      value: downloads,
      period: `${weekStart} to ${weekEnd}`,
    })) ?? [],
)

const width = 200
const height = 60

const range = computed(() =>
  dataset.value.reduce(
    (accumulator, { value }) => {
      accumulator.max = Math.max(accumulator.max, value)
      accumulator.min = Math.min(accumulator.min, value)
      return accumulator
    },
    { min: Infinity, max: 0 },
  ),
)

const d = computed(() =>
  [
    'M-2,60',
    ...dataset.value.map(
      ({ value }, index, { length }) =>
        `L${Math.round((width * index) / length)},${height - Math.round(((height - 2) * value) / (range.value.max - range.value.min))}`,
    ),
    'H242',
    'V62',
    'H0',
  ].join(' '),
)
</script>

<template>
  <div class="space-y-8">
    <!-- Download stats -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs text-fg-subtle uppercase tracking-wider">Weekly Downloads</h2>
      </div>
      <div class="w-full overflow-hidden">
        <div class="flex justify-between items-end">
          <h3>{{ dataset.at(-1)?.value ?? '-' }}</h3>
          <svg view-box="0 0 {width} 60" :width height="60">
            <path :d stroke="#6A6A6A" fill="#121212" stroke-width="2" />
          </svg>
        </div>
        <h4 class="text-fg-subtle">{{ dataset.at(-1)?.period ?? '-' }}</h4>
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
