<script setup lang="ts">
import type { DiffHunk, DiffSkipBlock } from '#shared/types'
import { guessLanguageFromPath } from '~/utils/language-detection'

const props = defineProps<{
  hunks: (DiffHunk | DiffSkipBlock)[]
  type: 'add' | 'delete' | 'modify'
  fileName?: string
  enableShiki?: boolean
  wordWrap?: boolean
}>()

const language = computed(() => {
  if (!props.fileName) return 'text'
  return guessLanguageFromPath(props.fileName)
})

// provide diff context into child components
provide('diffContext', {
  fileStatus: computed(() => props.type),
  language: computed(() => language.value),
  enableShiki: computed(() => props.enableShiki ?? false),
  wordWrap: computed(() => props.wordWrap ?? false),
})
</script>

<template>
  <table
    class="diff-table font-mono text-sm w-full m-0 border-separate border-0 outline-none overflow-x-auto border-spacing-0"
  >
    <tbody class="w-full box-border">
      <template v-for="(hunk, index) in hunks" :key="index">
        <DiffHunk v-if="hunk.type === 'hunk'" :hunk="hunk" />
        <DiffSkipBlock v-else :count="hunk.count" :content="hunk.content" />
      </template>
    </tbody>
  </table>
</template>

<style scoped>
.diff-table {
  --code-added: oklch(0.723 0.219 149.579);
  --code-removed: oklch(0.704 0.191 22.216);
}

:root[data-theme='light'] .diff-table {
  --code-added: oklch(0.527 0.154 150.069);
  --code-removed: oklch(0.577 0.184 27.325);
}
</style>
