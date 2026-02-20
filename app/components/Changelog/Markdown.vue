<script setup lang="ts">
const { info } = defineProps<{ info: ChangelogMarkdownInfo }>()

const { data } = useLazyFetch(() => `/api/changelog/md/${info.provider}/${info.repo}/${info.path}`)
</script>
<template>
  <div v-if="data?.toc && data.toc.length > 1" class="flex justify-end mt-3">
    <ReadmeTocDropdown :toc="data.toc" class="justify-self-end" />
  </div>
  <Readme v-if="data?.html" :html="data.html"></Readme>
</template>
