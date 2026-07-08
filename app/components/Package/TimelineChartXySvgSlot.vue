<script setup lang="ts">
import { computed } from 'vue'
import type { VueUiXySvgSlotProps } from 'vue-data-ui/vue-ui-xy'

const props = defineProps<{
  svg: VueUiXySvgSlotProps['svg']
  activeVersionPlot: TimelinePlotItem | null
  watermark?: string
  markersPositive: TimelineMarkerItem[]
  markersNegative: TimelineMarkerItem[]
  colors: Record<string, string>
  gradientColors: string[]
  pauseAnimations: boolean
}>()

const svgElementTransitionClass = computed(() => [
  'pointer-events-none',
  props.pauseAnimations
    ? '!transition-none'
    : '!transition-all !duration-500 !ease-[var(--super-ease-out)] motion-reduce:!transition-none',
])
</script>

<template>
  <!-- Print watermark-->
  <g v-if="svg.isPrintingSvg || svg.isPrintingImg" v-html="watermark" />

  <g class="pointer-events-none">
    <!-- Marker for selected version -->
    <circle
      v-if="activeVersionPlot"
      :class="svgElementTransitionClass"
      :cx="activeVersionPlot.x"
      :cy="activeVersionPlot.y"
      r="8"
      :fill="colors.accent"
      :stroke="colors.bg"
      stroke-width="2"
    />

    <!-- Marker for positive events -->
    <g v-for="plot in markersPositive" :key="plot.key" class="pointer-events-none">
      <path
        :d="`M ${plot.x - 4} ${plot.y - 20} l 4 6 l 10 -12`"
        fill="none"
        :stroke="colors.bg"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="svgElementTransitionClass"
      />
      <path
        :d="`M ${plot.x - 4} ${plot.y - 20} l 4 6 l 10 -12`"
        fill="none"
        :stroke="gradientColors.at(-1)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="svgElementTransitionClass"
      />
    </g>

    <!-- Marker for negative events -->
    <g v-for="plot in markersNegative" :key="plot.key" class="pointer-events-none">
      <path
        :d="`M ${plot.x} ${plot.y - 20 - (plot.offsetY ?? 0)} l -6 10 l 12 0 l -6 -10 m 0 5 l 0 2`"
        fill="none"
        :stroke="colors.bg"
        stroke-width="6"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="svgElementTransitionClass"
      />
      <path
        :d="`M ${plot.x} ${plot.y - 20 - (plot.offsetY ?? 0)} l -6 10 l 12 0 l -6 -10 m 0 5 l 0 2`"
        fill="none"
        :stroke="gradientColors[0]"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="svgElementTransitionClass"
      />
    </g>
  </g>
</template>
