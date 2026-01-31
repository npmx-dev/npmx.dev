<script setup lang="ts">
const { bookmarks, hasBookmarks, removeBookmark, clearBookmarks } = useBookmarks()

const isOpen = ref(false)

function handleMouseEnter() {
  isOpen.value = true
}

function handleMouseLeave() {
  isOpen.value = false
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

function handleRemove(packageName: string, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  removeBookmark(packageName)
}

function handleClearAll(event: Event) {
  event.preventDefault()
  clearBookmarks()
}
</script>

<template>
  <div
    class="relative flex items-center"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @keydown="handleKeydown"
  >
    <button
      type="button"
      class="link-subtle font-mono text-sm inline-flex items-center gap-1 leading-tight"
      :aria-expanded="isOpen"
      aria-haspopup="true"
    >
      <span
        class="w-[1em] h-[1em] shrink-0"
        :class="hasBookmarks ? 'i-carbon:bookmark-filled' : 'i-carbon:bookmark'"
        aria-hidden="true"
      />
      <span class="hidden sm:inline">{{ $t('header.bookmarks') }}</span>
      <span
        class="hidden sm:inline i-carbon-chevron-down w-3 h-3 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        aria-hidden="true"
      />
    </button>

    <Transition
      enter-active-class="transition-all duration-150"
      leave-active-class="transition-all duration-100"
      enter-from-class="opacity-0 translate-y-1"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div v-if="isOpen" class="absolute inset-ie-0 top-full pt-2 w-72 z-50">
        <div class="bg-bg-elevated border border-border rounded-lg shadow-lg overflow-hidden">
          <div class="px-3 py-2 border-b border-border flex items-center justify-between">
            <span class="font-mono text-xs text-fg-subtle">
              {{ $t('header.bookmarks_dropdown.title') }}
            </span>
            <button
              v-if="hasBookmarks"
              type="button"
              class="font-mono text-xs text-fg-subtle hover:text-fg transition-colors"
              @click="handleClearAll"
            >
              {{ $t('header.bookmarks_dropdown.clear_all') }}
            </button>
          </div>

          <ul v-if="hasBookmarks" class="py-1 max-h-80 overflow-y-auto">
            <li v-for="bookmark in bookmarks" :key="bookmark.packageName">
              <div class="flex items-center gap-1 px-3 hover:bg-bg-subtle transition-colors">
                <NuxtLink
                  :to="`/${bookmark.packageName}`"
                  class="flex-1 py-2 font-mono text-sm text-fg truncate"
                >
                  {{ bookmark.packageName }}
                </NuxtLink>
                <button
                  type="button"
                  class="p-1 text-fg-subtle hover:text-fg transition-colors shrink-0"
                  :aria-label="
                    $t('header.bookmarks_dropdown.remove', { name: bookmark.packageName })
                  "
                  @click="handleRemove(bookmark.packageName, $event)"
                >
                  <span class="i-carbon-close w-3 h-3 block" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>

          <div v-else class="px-3 py-4 text-center">
            <span class="text-fg-muted text-sm">
              {{ $t('header.bookmarks_dropdown.empty') }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
