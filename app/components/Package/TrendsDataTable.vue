<script setup lang="ts">
const props = defineProps<{
  dataset: { name: string; series: (number | null | undefined)[] }[]
  packageNames: string[]
  dates: number[]
  metricLabel: string
  dateFormatter: Intl.DateTimeFormat
  estimatedLastValue?: boolean
  maxHeight: number
}>()

const tableNumberFormatter = useCompactNumberFormatter()
const estimationNoteId = useId()

function isEstimatedValue(index: number, seriesIndex: number): boolean {
  const series = props.dataset[seriesIndex]?.series ?? []
  return !!props.estimatedLastValue && index === series.length - 1 && series[index] != null
}

const hasEstimatedValues = computed(() =>
  props.dataset.some(
    (series, index) =>
      series.series.length <= props.dates.length &&
      isEstimatedValue(series.series.length - 1, index),
  ),
)
</script>

<template>
  <div
    class="overflow-auto rounded-md border border-border focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
    :style="{ maxHeight: `${maxHeight}px` }"
    tabindex="0"
    role="region"
    :aria-label="$t('package.trends.chart_assistive_text.table_caption')"
  >
    <table class="w-full border-separate border-spacing-0 text-start text-sm font-mono">
      <caption class="sr-only">
        {{
          $t('package.trends.title')
        }}
        —
        {{
          metricLabel
        }}
      </caption>
      <thead class="sticky top-0 z-1 bg-bg-subtle">
        <tr>
          <th
            :colspan="dataset.length + 1"
            scope="colgroup"
            class="border-b border-border bg-bg-subtle px-3 py-3 text-start text-xs font-medium text-fg-muted"
          >
            {{ metricLabel }}
          </th>
        </tr>
        <tr>
          <th
            scope="col"
            class="border-b border-border bg-bg-subtle px-3 py-3 text-start text-xs font-medium text-fg-muted"
          >
            {{ $t('package.trends.date') }}
          </th>
          <th
            v-for="(series, index) in dataset"
            :key="index"
            scope="col"
            class="border-b border-border bg-bg-subtle px-3 py-3 text-end text-xs font-medium text-fg-muted whitespace-nowrap"
          >
            {{ packageNames[index] ?? series.name }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(date, index) in dates"
          :key="date"
          class="[&:not(:last-child)>*]:border-b [&>*]:border-border hover:bg-bg-subtle"
        >
          <th scope="row" class="px-3 py-2 text-start font-normal whitespace-nowrap">
            {{ dateFormatter.format(date) }}
          </th>
          <td
            v-for="(series, seriesIndex) in dataset"
            :key="seriesIndex"
            :aria-describedby="isEstimatedValue(index, seriesIndex) ? estimationNoteId : undefined"
            class="px-3 py-2 text-end tabular-nums whitespace-nowrap"
          >
            <span class="inline-flex items-center justify-end gap-2">
              <slot name="before-value" :index="index" :series-index="seriesIndex" />
              <span>
                {{
                  series.series[index] == null
                    ? $t('package.trends.no_data_short')
                    : tableNumberFormatter.format(series.series[index])
                }}
              </span>
              <span
                v-if="isEstimatedValue(index, seriesIndex)"
                class="text-xs text-fg-subtle"
                aria-hidden="true"
                >*</span
              >
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="hasEstimatedValues" :id="estimationNoteId" class="px-3 py-2 text-xs text-fg-subtle">
      * {{ $t('package.trends.legend_estimation') }}
    </p>
  </div>
</template>
