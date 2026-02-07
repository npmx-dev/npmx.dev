<script setup lang="ts">
import type { CompareResponse, FileChange } from '#shared/types'

const props = defineProps<{
  compare: CompareResponse
  groupedDeps: Map<string, CompareResponse['dependencyChanges']>
  allChanges: FileChange[]
}>()

const selectedFile = defineModel<FileChange | null>('selectedFile', { default: null })
const fileFilter = defineModel<'all' | 'added' | 'removed' | 'modified'>('fileFilter', {
  default: 'all',
})
const open = defineModel<boolean>('open', { default: false })

const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)

const isLocked = useScrollLock(import.meta.client ? document : null)
watch(open, value => {
  isLocked.value = value
})
</script>

<template>
  <!-- Backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="open" class="md:hidden fixed inset-0 z-40 bg-black/50" @click="open = false" />
  </Transition>

  <!-- Drawer -->
  <Transition
    enter-active-class="transition-transform duration-200"
    enter-from-class="-translate-x-full"
    enter-to-class="translate-x-0"
    leave-active-class="transition-transform duration-200"
    leave-from-class="translate-x-0"
    leave-to-class="-translate-x-full"
  >
    <aside
      v-if="open"
      class="md:hidden fixed inset-y-0 inset-is-0 z-50 w-72 max-w-[85vw] bg-bg-subtle border-ie border-border overflow-y-auto flex flex-col"
    >
      <div
        class="sticky top-0 bg-bg-subtle border-b border-border px-4 py-3 flex items-center justify-between gap-2"
      >
        <div class="text-xs font-mono text-fg-muted flex items-center gap-2">
          <span class="flex items-center gap-1">
            <span class="text-green-500">+{{ props.compare.stats.filesAdded }}</span>
            <span class="text-fg-subtle">/</span>
            <span class="text-red-500">-{{ props.compare.stats.filesRemoved }}</span>
            <span class="text-fg-subtle">/</span>
            <span class="text-yellow-500">~{{ props.compare.stats.filesModified }}</span>
          </span>
          <span class="text-fg-subtle">•</span>
          <span>{{ $t('compare.files_count', { count: props.allChanges.length }) }}</span>
        </div>
        <button
          type="button"
          class="text-fg-muted hover:text-fg transition-colors"
          :aria-label="$t('compare.close_files_panel')"
          @click="open = false"
        >
          <span class="i-carbon:close w-5 h-5" />
        </button>
      </div>

      <DiffSidebarPanel
        :compare="props.compare"
        :grouped-deps="props.groupedDeps"
        :all-changes="props.allChanges"
        v-model:selected-file="selectedFile"
        v-model:file-filter="fileFilter"
      />
    </aside>
  </Transition>
</template>
