<script setup lang="ts">
import type { DiffHunk as DiffHunkType } from '#shared/types'

defineProps<{
  hunk: DiffHunkType
}>()
</script>

<template>
  <DiffLine v-for="(line, index) in hunk.lines" :key="index" :line="line" />
</template>
