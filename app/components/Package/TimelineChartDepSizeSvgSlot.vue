<script setup lang="ts">
import type { VueUiStackbarSvgSlotProps } from 'vue-data-ui/vue-ui-stackbar'

const props = defineProps<{
  svg: VueUiStackbarSvgSlotProps['svg']
  watermark?: string
  activeVersionPlot: Partial<TimelinePlotItem> | null
  colors: Record<string, string>
  pauseAnimations: boolean
}>()
</script>

<template>
  <!-- Print watermark-->
  <g v-if="svg.isPrintingSvg || svg.isPrintingImg" v-html="watermark" />

  <g class="pointer-events-none">
    <!-- Marker for selected version -->
    <circle
      v-if="activeVersionPlot"
      :class="[
        'pointer-events-none',
        pauseAnimations
          ? '!transition-none'
          : '!transition-all !duration-500 !ease-[var(--super-ease-out)] motion-reduce:!transition-none',
      ]"
      :cx="activeVersionPlot.x"
      :cy="activeVersionPlot.y"
      r="8"
      :fill="colors.accent"
      :stroke="colors.bg"
      stroke-width="2"
    />
  </g>
</template>
