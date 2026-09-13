<script setup lang="ts">
import { NuxtLink } from '#components'
import type { MenuDropdownItem } from '~/types'

defineProps<{
  items: MenuDropdownItem[]
}>()

defineSlots<{
  trigger(props: { open: boolean; toggle: () => void }): unknown
}>()

const rootRef = useTemplateRef('rootRef')
const panelRef = useTemplateRef('panelRef')

const keyboardShortcutsEnabled = useKeyboardShortcuts()

const isOpen = shallowRef(false)
// Set by a click on the trigger: keeps the menu open regardless of hover/focus
// until it's explicitly dismissed (click again, click an item, click outside, Escape).
const isPinned = shallowRef(false)

// Full-width panel is teleported to <body> so it can bleed edge-to-edge;
// track the closest <header> to pin the panel right under it.
const headerEl = shallowRef<HTMLElement | null>(null)
const { bottom: headerBottom } = useElementBounding(headerEl)

let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = undefined
  }
}

function open() {
  clearCloseTimer()
  if (!headerEl.value) {
    headerEl.value = rootRef.value?.closest('header') ?? null
  }
  isOpen.value = true
}

function close() {
  clearCloseTimer()
  isOpen.value = false
  isPinned.value = false
}

// Delay closing so moving the pointer/focus from the trigger down into the
// teleported panel (which isn't a DOM descendant of the trigger) doesn't flicker-close it.
function scheduleClose() {
  if (isPinned.value) return
  clearCloseTimer()
  closeTimer = setTimeout(close, 200)
}

function toggle() {
  if (isOpen.value && isPinned.value) {
    close()
  } else {
    open()
    isPinned.value = true
  }
}

function handleItemClick(item: MenuDropdownItem) {
  if (item.type === 'action') {
    item.handler()
  }
  close()
}

onClickOutside(rootRef, close, { ignore: [panelRef] })

useEventListener('keydown', event => {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
})

onUnmounted(clearCloseTimer)
</script>

<template>
  <div
    ref="rootRef"
    class="relative"
    @mouseenter="open"
    @mouseleave="scheduleClose"
    @focusin="open"
    @focusout="scheduleClose"
  >
    <slot name="trigger" :open="isOpen" :toggle="toggle" />

    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-150"
        leave-active-class="transition-all duration-100"
        enter-from-class="opacity-0 -translate-y-1"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="isOpen"
          ref="panelRef"
          role="menu"
          class="fixed inset-x-0 z-60"
          :style="{ top: `${headerBottom}px` }"
          @mouseenter="open"
          @mouseleave="scheduleClose"
          @focusin="open"
          @focusout="scheduleClose"
        >
          <div
            class="absolute inset-0 -z-1 bg-bg/70 backdrop-blur-xl border-b border-border-subtle"
          />

          <div class="container py-6">
            <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <component
                :is="item.type === 'link' ? NuxtLink : 'button'"
                v-for="(item, index) in items"
                :key="index"
                role="menuitem"
                :type="item.type === 'action' ? 'button' : undefined"
                :to="item.type === 'link' ? item.href : undefined"
                :target="item.type === 'link' && item.external ? '_blank' : undefined"
                :aria-keyshortcuts="keyboardShortcutsEnabled ? item.shortcut : undefined"
                class="group cursor-pointer flex items-start gap-3 p-3 rounded-lg border border-transparent text-start hover:bg-bg-elevated hover:border-border focus-visible:bg-bg-elevated focus-visible:border-border transition-colors duration-200 focus-visible:outline-none"
                @click="handleItemClick(item)"
              >
                <span
                  v-if="item.icon"
                  class="flex-shrink-0 w-9 h-9 rounded-md bg-bg-muted flex items-center justify-center group-hover:bg-bg-subtle transition-colors duration-200"
                >
                  <span :class="item.icon" class="w-4.5 h-4.5 text-fg-muted" aria-hidden="true" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="font-mono text-sm text-fg truncate">{{ item.title }}</span>
                    <kbd
                      v-if="item.shortcut && keyboardShortcutsEnabled"
                      data-kbd-hint
                      class="ms-auto shrink-0 inline-flex items-center justify-center min-w-4 h-4 px-1 text-3xs text-fg bg-bg-muted border border-border rounded no-underline"
                      aria-hidden="true"
                    >
                      {{ item.shortcut }}
                    </kbd>
                  </span>
                  <span v-if="item.description" class="block text-xs text-fg-subtle mt-0.5">
                    {{ item.description }}
                  </span>
                </span>
              </component>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
