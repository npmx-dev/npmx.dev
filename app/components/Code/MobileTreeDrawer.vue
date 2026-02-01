<script setup lang="ts">
import type { PackageFileTree } from '#shared/types'

defineProps<{
  tree: PackageFileTree[]
  currentPath: string
  baseUrl: string
}>()

const isOpen = shallowRef(false)

// Close drawer on navigation
const route = useRoute()
watch(
  () => route.fullPath,
  () => {
    isOpen.value = false
  },
)

const isLocked = useScrollLock(document)
// Prevent body scroll when drawer is open
watch(isOpen, open => (isLocked.value = open))
</script>

<template>
  <!-- Toggle button (mobile only) -->
  <button
    type="button"
    class="md:hidden fixed bottom-4 inset-ie-4 z-40 w-12 h-12 bg-bg-elevated border border-border rounded-full shadow-lg flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
    :aria-label="$t('code.toggle_tree')"
    @click="isOpen = !isOpen"
  >
    <span class="w-5 h-5" :class="isOpen ? 'i-carbon:close' : 'i-carbon:folder'" />
  </button>

  <!-- Backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-200"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="isOpen" class="md:hidden fixed inset-0 z-40 bg-black/50" @click="isOpen = false" />
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
      v-if="isOpen"
      class="md:hidden fixed inset-y-0 inset-is-0 z-50 w-72 bg-bg-subtle border-ie border-border overflow-y-auto"
    >
      <div
        class="sticky top-0 bg-bg-subtle border-b border-border px-4 py-3 flex items-center justify-start"
      >
        <span class="font-mono text-sm text-fg-muted">{{ $t('code.files_label') }}</span>
        <span aria-hidden="true" class="flex-shrink-1 flex-grow-1" />
        <button
          type="button"
          class="text-fg-muted hover:text-fg transition-colors"
          :aria-label="$t('code.close_tree')"
          @click="isOpen = false"
        >
          <span class="i-carbon:close w-5 h-5" />
        </button>
      </div>
      <CodeFileTree :tree="tree" :current-path="currentPath" :base-url="baseUrl" />
    </aside>
  </Transition>
</template>
