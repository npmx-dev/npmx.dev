<script setup lang="ts">
/**
 * This component is designed to create various patterns from seeds, and included
 * inside vue-data-ui charts in the #pattern slots.
 * Using patterns helps users with vision deficency (like achromatopsia) to distinguish
 * series in the context of data visualisation.
 */
import { computed } from 'vue'
import { createSeededSvgPattern } from '~/utils/charts'

const props = defineProps<{
  id: string
  seed: string | number
  color?: string
  foregroundColor: string
  fallbackColor: string
  maxSize: number
  minSize: number
}>()

const pattern = computed(() =>
  createSeededSvgPattern(props.seed, {
    foregroundColor: props.foregroundColor,
    backgroundColor: props.color ?? props.fallbackColor,
    minimumSize: props.minSize,
    maximumSize: props.maxSize,
  }),
)
</script>

<template>
  <pattern
    :id
    patternUnits="userSpaceOnUse"
    :width="pattern.width"
    :height="pattern.height"
    :patternTransform="`rotate(${pattern.rotation})`"
    v-html="pattern.contentMarkup"
  />
</template>
