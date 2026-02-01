<script setup lang="ts">
const props = defineProps<{
  packageName: string
}>()

const { useIsBookmarked, toggleBookmark } = useBookmarks()

const isBookmarked = useIsBookmarked(() => props.packageName)

function handleClick() {
  toggleBookmark(props.packageName)
}
</script>

<template>
  <button
    type="button"
    class="p-1.5 rounded transition-colors duration-150 border border-transparent hover:bg-bg hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
    :aria-label="
      isBookmarked
        ? $t('bookmarks.remove', { name: packageName })
        : $t('bookmarks.add', { name: packageName })
    "
    :aria-pressed="isBookmarked"
    @click="handleClick"
  >
    <span
      class="block w-4 h-4 transition-colors duration-150"
      :class="
        isBookmarked
          ? 'i-carbon:bookmark-filled text-accent'
          : 'i-carbon:bookmark text-fg-subtle hover:text-fg'
      "
      aria-hidden="true"
    />
  </button>
</template>
