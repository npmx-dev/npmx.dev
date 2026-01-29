<script setup lang="ts">
defineProps<{
  /** Dependency path from root to vulnerable package (readonly from VulnerabilityTreeResult) */
  path: readonly string[]
}>()

const isOpen = shallowRef(false)
const popupEl = ref<HTMLElement | null>(null)
const popupPosition = shallowRef<{ top: number; left: number } | null>(null)

// Function ref - captures the element when popup mounts
function setPopupRef(el: unknown) {
  popupEl.value = (el as HTMLElement) || null
}

function closePopup() {
  isOpen.value = false
}

// Close popup on click outside
onClickOutside(popupEl, () => {
  if (isOpen.value) closePopup()
})

// Close popup on ESC or scroll
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePopup()
}

useEventListener(document, 'keydown', handleKeydown)
useEventListener('scroll', closePopup, true)

function togglePopup(event: MouseEvent) {
  if (isOpen.value) {
    closePopup()
  } else {
    const button = event.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    popupPosition.value = {
      top: rect.bottom + 4,
      left: rect.left,
    }
    isOpen.value = true
  }
}

function getPopupStyle(): Record<string, string> {
  if (!popupPosition.value) return {}
  return {
    top: `${popupPosition.value.top}px`,
    left: `${popupPosition.value.left}px`,
  }
}

// Parse package string "name@version" into { name, version }
function parsePackageString(pkg: string): { name: string; version: string } {
  const atIndex = pkg.lastIndexOf('@')
  if (atIndex > 0) {
    return { name: pkg.slice(0, atIndex), version: pkg.slice(atIndex + 1) }
  }
  return { name: pkg, version: '' }
}
</script>

<template>
  <div class="relative">
    <!-- Path badge button -->
    <button
      type="button"
      class="path-badge font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 cursor-pointer transition-all duration-200 ease-out whitespace-nowrap flex items-center gap-1 hover:bg-amber-500/20 hover:border-amber-500/50"
      :aria-expanded="isOpen"
      @click.stop="togglePopup"
    >
      <span class="i-carbon-tree-view w-3 h-3" aria-hidden="true" />
      <span>{{ $t('package.vulnerabilities.path') }}</span>
    </button>

    <!-- Tree popup -->
    <div
      v-if="isOpen"
      :ref="setPopupRef"
      class="fixed z-[100] bg-bg-elevated border border-border rounded-lg shadow-xl p-3 min-w-64 max-w-sm"
      :style="getPopupStyle()"
    >
      <ul class="list-none m-0 p-0 space-y-0.5">
        <li
          v-for="(pathItem, idx) in path"
          :key="idx"
          class="font-mono text-xs"
          :style="{ paddingLeft: `${idx * 12}px` }"
        >
          <span v-if="idx > 0" class="text-fg-subtle mr-1">└─</span>
          <NuxtLink
            :to="{
              name: 'package',
              params: {
                package: [
                  ...parsePackageString(pathItem).name.split('/'),
                  'v',
                  parsePackageString(pathItem).version,
                ],
              },
            }"
            class="hover:underline"
            :class="idx === path.length - 1 ? 'text-fg font-medium' : 'text-fg-muted'"
            @click="closePopup"
          >
            {{ pathItem }}
          </NuxtLink>
          <span v-if="idx === path.length - 1" class="ml-1 text-amber-500">⚠</span>
        </li>
      </ul>
    </div>
  </div>
</template>
