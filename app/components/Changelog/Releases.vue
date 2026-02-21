<script setup lang="ts">
const { info } = defineProps<{ info: ChangelogReleaseInfo }>()

const { data: releases } = useFetch<ReleaseData[]>(
  () => `/api/changelog/releases/${info.provider}/${info.repo}`,
)
</script>
<template>
  <div class="flex flex-col gap-2 py-3" v-if="releases">
    <ChangelogCard v-for="release of releases" :release :key="release.id" />
  </div>
</template>
