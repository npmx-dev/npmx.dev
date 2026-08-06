<script setup lang="ts">
import type {
  VueUiStackbarTooltipDatapoint,
  VueUiStackbarTooltipSlotProps,
} from 'vue-data-ui/vue-ui-stackbar'
import type { StackbarTooltipPoint } from '~/utils/charts'

const props = defineProps<{
  datapoint: VueUiStackbarTooltipDatapoint[]
  timeLabel: VueUiStackbarTooltipSlotProps['timeLabel']
  datetime: string | Date
  datapoints: StackbarTooltipPoint[]
}>()

const bytesFormatter = useBytesFormatter()
</script>

<template>
  <div class="font-mono text-xs min-w-48 max-w-[28rem]">
    <div class="border-border border-b pb-2 mb-2">
      <div class="text-fg font-semibold truncate">{{ timeLabel }}</div>
      <DateTime
        :datetime
        class="text-xs text-fg-subtle"
        year="numeric"
        month="short"
        day="numeric"
      />
    </div>

    <ul class="flex flex-col gap-1.5 max-h-80 overflow-y-auto pe-1">
      <li
        v-for="point in datapoints"
        :key="point.id"
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded px-1"
        :class="point.removed ? 'opacity-60' : ''"
      >
        <span
          class="w-2.5 h-2.5 rounded-xs shrink-0"
          :style="{ backgroundColor: point.color }"
          aria-hidden="true"
        />

        <span
          class="min-w-0 truncate text-[var(--fg)]/70"
          :class="point.removed ? 'line-through' : ''"
          :title="point.name"
        >
          {{ point.name }}
        </span>

        <span class="flex items-baseline gap-1.5 text-sm text-fg">
          {{ bytesFormatter.format(point.size) }}

          <span
            v-if="point.delta !== 0"
            class="leading-none"
            :class="
              point.delta > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            "
          >
            ({{ point.delta > 0 ? '+' : '-' }}{{ bytesFormatter.format(Math.abs(point.delta)) }})
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>
