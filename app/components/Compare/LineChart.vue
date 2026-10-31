<script setup lang="ts">
import TrendsChart from '../Package/TrendsChart.vue'

const { packages } = defineProps<{
  packages: string[]
}>()
</script>

<template>
  <div class="font-mono">
    <TrendsChart :package-names="packages" show-facet-selector />
  </div>
</template>
