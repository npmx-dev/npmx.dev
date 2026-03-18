<script setup lang="ts">
defineProps<{
  hunk: DiffHunk
}>()
</script>

<template>
  <DiffLine v-for="(line, index) in hunk.lines" :key="index" :line="line" />
</template>
