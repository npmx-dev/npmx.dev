<script setup lang="ts">
import DownloadAnalytics from '../Package/DownloadAnalytics.vue'

const { packages } = defineProps<{
  packages: string[]
}>()
</script>

<template>
  <div class="font-mono">
    <DownloadAnalytics :package-names="packages" :in-modal="false" />
  </div>
</template>
