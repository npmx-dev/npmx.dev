<script setup lang="ts">
import type { TocItem } from '#shared/types/readme'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { scrollToAnchor } from '~/utils/scrollToAnchor'

const props = defineProps<{
  toc: TocItem[]
  activeId?: string | null
  scrollToHeading?: (id: string) => void
}>()

interface TocNode extends TocItem {
  children: TocNode[]
}

function buildTocTree(items: TocItem[]): TocNode[] {
  const result: TocNode[] = []
  const stack: TocNode[] = []

  for (const item of items) {
    const node: TocNode = { ...item, children: [] }

    // Find parent: look for the last item with smaller depth
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= item.depth) {
      stack.pop()
    }

    if (stack.length === 0) {
      result.push(node)
    } else {
      stack[stack.length - 1]!.children.push(node)
    }

    stack.push(node)
  }

  return result
}

const tocTree = computed(() => buildTocTree(props.toc))

// Create a map from id to index for efficient lookup
const idToIndex = computed(() => {
  const map = new Map<string, number>()
  props.toc.forEach((item, index) => map.set(item.id, index))
  return map
})

const listRef = useTemplateRef('listRef')
const triggerRef = useTemplateRef('triggerRef')
const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)

const dropdownPosition = shallowRef<{ top: number; right: number } | null>(null)

function getDropdownStyle(): Record<string, string> {
  if (!dropdownPosition.value) return {}
  return {
    top: `${dropdownPosition.value.top}px`,
    right: `${document.documentElement.clientWidth - dropdownPosition.value.right}px`,
  }
}

// Close on scroll (but not when scrolling inside the dropdown)
function handleScroll(event: Event) {
  if (!isOpen.value) return
  if (listRef.value && event.target instanceof Node && listRef.value.contains(event.target)) {
    return
  }
  close()
}
useEventListener('scroll', handleScroll, true)

// Generate unique ID for accessibility
const inputId = useId()
const listboxId = `${inputId}-toc-listbox`

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    if (triggerRef.value) {
      const rect = triggerRef.value.getBoundingClientRect()
      dropdownPosition.value = {
        top: rect.bottom + 4,
        right: rect.right,
      }
    }
    isOpen.value = true
    // Highlight active item if any
    const activeIndex = idToIndex.value.get(props.activeId ?? '')
    highlightedIndex.value = activeIndex ?? 0
  }
}

function close() {
  isOpen.value = false
  highlightedIndex.value = -1
}

function select(id: string) {
  scrollToAnchor(id, { scrollFn: props.scrollToHeading })
  close()
  triggerRef.value?.focus()
}

function getIndex(id: string): number {
  return idToIndex.value.get(id) ?? -1
}

// Check for reduced motion preference
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

onClickOutside(listRef, close, { ignore: [triggerRef] })

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return

  const itemCount = props.toc.length

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = (highlightedIndex.value + 1) % itemCount
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value =
        highlightedIndex.value <= 0 ? itemCount - 1 : highlightedIndex.value - 1
      break
    case 'Enter': {
      event.preventDefault()
      const item = props.toc[highlightedIndex.value]
      if (item) {
        select(item.id)
      }
      break
    }
    case 'Escape':
      close()
      triggerRef.value?.focus()
      break
  }
}
</script>

<template>
  <button
    ref="triggerRef"
    type="button"
    class="flex items-center gap-1.5 px-2 py-2 font-mono text-xs text-fg-muted bg-bg-subtle border border-border-subtle border-solid rounded-md transition-colors duration-150 hover:(text-fg border-border-hover) active:scale-95 focus:border-border-hover focus-visible:outline-accent/70 hover:text-fg"
    :aria-expanded="isOpen"
    aria-haspopup="listbox"
    :aria-label="$t('package.readme.toc_title')"
    :aria-controls="listboxId"
    @click="toggle"
    @keydown="handleKeydown"
  >
    <span class="i-carbon:list w-3.5 h-3.5" aria-hidden="true" />
    <span
      class="i-carbon:chevron-down w-3 h-3"
      :class="[
        { 'rotate-180': isOpen },
        prefersReducedMotion ? '' : 'transition-transform duration-200',
      ]"
      aria-hidden="true"
    />
  </button>

  <Teleport to="body">
    <Transition
      :enter-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-150'"
      :enter-from-class="prefersReducedMotion ? '' : 'opacity-0'"
      enter-to-class="opacity-100"
      :leave-active-class="prefersReducedMotion ? '' : 'transition-opacity duration-100'"
      leave-from-class="opacity-100"
      :leave-to-class="prefersReducedMotion ? '' : 'opacity-0'"
    >
      <div
        v-if="isOpen"
        :id="listboxId"
        ref="listRef"
        role="listbox"
        :aria-activedescendant="
          highlightedIndex >= 0 ? `${listboxId}-${toc[highlightedIndex]?.id}` : undefined
        "
        :aria-label="$t('package.readme.toc_title')"
        :style="getDropdownStyle()"
        class="fixed bg-bg-subtle border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto w-56 overscroll-contain"
      >
        <template v-for="node in tocTree" :key="node.id">
          <div
            :id="`${listboxId}-${node.id}`"
            role="option"
            :aria-selected="activeId === node.id"
            class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors duration-150"
            :class="[
              activeId === node.id ? 'text-fg font-medium' : 'text-fg-muted',
              highlightedIndex === getIndex(node.id) ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
            ]"
            @click="select(node.id)"
            @mouseenter="highlightedIndex = getIndex(node.id)"
          >
            <span class="truncate">{{ node.text }}</span>
          </div>

          <template v-for="child in node.children" :key="child.id">
            <div
              :id="`${listboxId}-${child.id}`"
              role="option"
              :aria-selected="activeId === child.id"
              class="flex items-center gap-2 px-3 py-1.5 ps-6 text-sm cursor-pointer transition-colors duration-150"
              :class="[
                activeId === child.id ? 'text-fg font-medium' : 'text-fg-subtle',
                highlightedIndex === getIndex(child.id) ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
              ]"
              @click="select(child.id)"
              @mouseenter="highlightedIndex = getIndex(child.id)"
            >
              <span class="truncate">{{ child.text }}</span>
            </div>

            <div
              v-for="grandchild in child.children"
              :id="`${listboxId}-${grandchild.id}`"
              :key="grandchild.id"
              role="option"
              :aria-selected="activeId === grandchild.id"
              class="flex items-center gap-2 px-3 py-1.5 ps-9 text-sm cursor-pointer transition-colors duration-150"
              :class="[
                activeId === grandchild.id ? 'text-fg font-medium' : 'text-fg-subtle',
                highlightedIndex === getIndex(grandchild.id)
                  ? 'bg-bg-elevated'
                  : 'hover:bg-bg-elevated',
              ]"
              @click="select(grandchild.id)"
              @mouseenter="highlightedIndex = getIndex(grandchild.id)"
            >
              <span class="truncate">{{ grandchild.text }}</span>
            </div>
          </template>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
