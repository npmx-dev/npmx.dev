<script setup lang="ts">
import type { TocItem } from '#shared/types/readme'
import { onClickOutside, useEventListener } from '@vueuse/core'

const props = defineProps<{
  toc: TocItem[]
  activeId?: string | null
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

const menuRef = useTemplateRef('menuRef')
const triggerRef = useTemplateRef('triggerRef')
const isOpen = shallowRef(false)

const dropdownPosition = shallowRef<{ top: number; right: number } | null>(null)

function getDropdownStyle(): Record<string, string> {
  if (!dropdownPosition.value) return {}
  return {
    top: `${dropdownPosition.value.top}px`,
    right: `${document.documentElement.clientWidth - dropdownPosition.value.right}px`,
  }
}

// Close on scroll (but not when scrolling inside the menu)
function handleScroll(event: Event) {
  if (!isOpen.value) return
  if (menuRef.value && event.target instanceof Node && menuRef.value.contains(event.target)) {
    return
  }
  close()
}
useEventListener('scroll', handleScroll, { passive: true })

// Generate unique ID for accessibility
const inputId = useId()
const menuId = `${inputId}-toc-menu`

function getMenuItems(): HTMLElement[] {
  if (!menuRef.value) return []
  return Array.from(menuRef.value.querySelectorAll<HTMLElement>('[role="menuitem"]'))
}

function open() {
  const rect = triggerRef.value?.getBoundingClientRect()
  if (rect) {
    dropdownPosition.value = {
      top: rect.bottom + 4,
      right: rect.right,
    }
  }
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    open()
  }
}

// Check for reduced motion preference
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

onClickOutside(menuRef, close, { ignore: [triggerRef] })

function handleTriggerKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp':
      event.preventDefault()
      if (!isOpen.value) open()
      break
    case 'Escape':
      if (isOpen.value) close()
      break
  }
}

function handleMenuKeydown(event: KeyboardEvent) {
  const items = getMenuItems()
  const currentIndex = items.findIndex(el => el === document.activeElement)

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      items[(currentIndex + 1) % items.length]?.focus()
      break
    case 'ArrowUp':
      event.preventDefault()
      items[currentIndex <= 0 ? items.length - 1 : currentIndex - 1]?.focus()
      break
    case 'Home':
      event.preventDefault()
      items[0]?.focus()
      break
    case 'End':
      event.preventDefault()
      items[items.length - 1]?.focus()
      break
    case 'Escape':
      close()
      triggerRef.value?.focus()
      break
    case 'Tab':
      // Close menu and return focus to trigger; Tab then advances naturally from trigger
      event.preventDefault()
      close()
      triggerRef.value?.focus()
      break
  }
}

function handleMenuFocusout(event: FocusEvent) {
  if (!menuRef.value?.contains(event.relatedTarget as Node | null)) {
    close()
  }
}

watch(isOpen, isNowOpen => {
  if (isNowOpen) {
    nextTick(() => {
      const items = getMenuItems()
      const activeIndex = props.activeId ? (idToIndex.value.get(props.activeId) ?? 0) : 0
      const target = items[activeIndex] ?? items[0]
      target?.focus()
      target?.scrollIntoView({ block: 'nearest' })
    })
  }
})
</script>

<template>
  <ButtonBase
    ref="triggerRef"
    type="button"
    :aria-expanded="isOpen"
    aria-haspopup="menu"
    :aria-label="$t('package.readme.toc_title')"
    :aria-controls="isOpen ? menuId : undefined"
    @click="toggle"
    @keydown="handleTriggerKeydown"
    classicon="i-lucide:list"
    class="px-2.5"
    block
    v-bind="$attrs"
  >
    <span
      class="i-lucide:chevron-down w-3 h-3"
      :class="[
        { 'rotate-180': isOpen },
        prefersReducedMotion ? '' : 'transition-transform duration-200',
      ]"
      aria-hidden="true"
    />
  </ButtonBase>

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
        :id="menuId"
        ref="menuRef"
        role="menu"
        :aria-label="$t('package.readme.toc_title')"
        :style="getDropdownStyle()"
        tabindex="-1"
        @keydown="handleMenuKeydown"
        @focusout="handleMenuFocusout"
        class="fixed bg-bg-subtle border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto w-56 overscroll-contain"
      >
        <template v-for="node in tocTree" :key="node.id">
          <NuxtLink
            :id="`${menuId}-${node.id}`"
            :to="`#${node.id}`"
            role="menuitem"
            tabindex="-1"
            class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors duration-150 hover:bg-bg-elevated focus:bg-bg-elevated"
            :class="activeId === node.id ? 'text-fg font-medium' : 'text-fg-muted'"
            dir="auto"
            @click="close()"
          >
            <span class="truncate">{{ node.text }}</span>
          </NuxtLink>

          <template v-for="child in node.children" :key="child.id">
            <NuxtLink
              :id="`${menuId}-${child.id}`"
              :to="`#${child.id}`"
              role="menuitem"
              tabindex="-1"
              class="flex items-center gap-2 px-3 py-1.5 ps-6 text-sm cursor-pointer transition-colors duration-150 hover:bg-bg-elevated focus:bg-bg-elevated"
              :class="activeId === child.id ? 'text-fg font-medium' : 'text-fg-subtle'"
              dir="auto"
              @click="close()"
            >
              <span class="truncate">{{ child.text }}</span>
            </NuxtLink>

            <NuxtLink
              v-for="grandchild in child.children"
              :id="`${menuId}-${grandchild.id}`"
              :to="`#${grandchild.id}`"
              :key="grandchild.id"
              role="menuitem"
              tabindex="-1"
              class="flex items-center gap-2 px-3 py-1.5 ps-9 text-sm cursor-pointer transition-colors duration-150 hover:bg-bg-elevated focus:bg-bg-elevated"
              :class="grandchild.id === activeId ? 'text-fg font-medium' : 'text-fg-subtle'"
              dir="auto"
              @click="close()"
            >
              <span class="truncate">{{ grandchild.text }}</span>
            </NuxtLink>
          </template>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
