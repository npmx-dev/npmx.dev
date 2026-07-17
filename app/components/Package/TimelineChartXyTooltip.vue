<script setup lang="ts">
import type { VueUiXyTooltipSlotProps } from 'vue-data-ui/vue-ui-xy'
import type { SubEvent } from '~~/server/api/registry/timeline/[...pkg].get'

const props = defineProps<{
  timeLabel: VueUiXyTooltipSlotProps['timeLabel']
  version?: string
  tags?: string[]
  datetime: string | Date
  totalSize: string
  dependencyCount: string
  events?: SubEvent[]
  activeTab: TimelineChartMetric
}>()
</script>

<template>
  <div class="font-mono text-xs flex flex-col">
    <div class="border-border border-b pb-2 mb-2 flex flex-col">
      <div class="flex flex-row gap-4">
        <span class="text-fg">{{ version }}</span>
        <span
          v-for="tag in tags"
          :key="tag"
          class="text-3xs font-semibold uppercase tracking-wide"
          :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
        >
          {{ tag }}
        </span>
      </div>
      <DateTime
        :datetime
        class="text-xs text-fg-subtle"
        year="numeric"
        month="short"
        day="numeric"
      />
    </div>

    <div :class="activeTab === 'totalSize' ? 'flex flex-col' : 'flex flex-col-reverse'">
      <!-- Install size -->
      <div class="flex flex-row gap-2 items-end">
        <span class="text-[var(--fg)]/70">{{ $t('package.stats.install_size') }}</span>
        <span class="text-sm">
          {{ totalSize }}
        </span>
      </div>

      <!-- Dependency count -->
      <div class="flex flex-row gap-2 items-end">
        <span class="text-[var(--fg)]/70">{{ $t('compare.dependencies') }}</span>
        <span class="text-sm">
          {{ dependencyCount }}
        </span>
      </div>
    </div>

    <!-- Positive & negative events -->
    <ol v-if="events?.length" class="relative font-[Geist] mt-2">
      <li v-for="event in events" :key="event.key" class="relative mb-1 ms-4 last:mb-0">
        <span
          class="absolute -start-[1rem] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
          :class="
            event.positive ? 'bg-green-500 border-green-600' : 'bg-amber-500 border-amber-600'
          "
        >
          <span class="w-2 h-2 text-white" :class="event.icon" aria-hidden="true" />
        </span>
        <p
          class="text-xs"
          :class="
            event.positive
              ? 'text-green-700 dark:text-green-400'
              : 'text-amber-700 dark:text-amber-400'
          "
        >
          {{ event.text }}
        </p>
      </li>
    </ol>
  </div>
</template>
