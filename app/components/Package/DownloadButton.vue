<script setup lang="ts">
import type { SlimPackumentVersion } from '#shared/types'
import { onClickOutside, useEventListener, useMediaQuery } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    packageName: string
    version: SlimPackumentVersion
    size?: 'small' | 'medium'
  }>(),
  {
    size: 'medium',
  },
)

const triggerRef = useTemplateRef('triggerRef')
const listRef = useTemplateRef('listRef')
const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)
const dropdownPosition = shallowRef<{ top: number; left: number } | null>(null)

const menuId = 'download-menu'
const menuItems = computed(() => {
  const items: { id: string; icon: string; disabled: boolean }[] = [
    { id: 'package', icon: 'i-lucide:package', disabled: false },
  ]
  return items
})

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

function getDropdownStyle(): Record<string, string> {
  if (!dropdownPosition.value) return {}
  return {
    top: `${dropdownPosition.value.top}px`,
    left: `${dropdownPosition.value.left}px`,
  }
}

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    const rect = triggerRef.value?.$el?.getBoundingClientRect()
    if (rect) {
      dropdownPosition.value = {
        top: rect.bottom + 4,
        left: rect.left,
      }
    }
    isOpen.value = true
    highlightedIndex.value = 0
  }
}

function close() {
  isOpen.value = false
  highlightedIndex.value = -1
}

onClickOutside(listRef, close, { ignore: [triggerRef] })

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = (highlightedIndex.value + 1) % menuItems.value.length
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value =
        highlightedIndex.value <= 0 ? menuItems.value.length - 1 : highlightedIndex.value - 1
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      handleAction(menuItems.value[highlightedIndex.value])
      break
    case 'Escape':
      event.preventDefault()
      close()
      triggerRef.value?.$el?.focus()
      break
    case 'Tab':
      close()
      break
  }
}

function handleAction(item: (typeof menuItems.value)[number] | undefined) {
  if (!item || item.disabled) return
  if (item.id === 'package') {
    downloadPackage()
  }
  close()
}

async function downloadPackage() {
  const tarballUrl = props.version.dist.tarball
  if (!tarballUrl) return

  try {
    const response = await fetch(tarballUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch tarball (${response.status})`)
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch {
    // Fallback to direct link for non-CORS or other issues, though download attribute may be ignored
    const link = document.createElement('a')
    link.href = tarballUrl
    link.download = `${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

useEventListener('scroll', () => isOpen.value && close(), { passive: true })

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <ButtonBase
    ref="triggerRef"
    v-bind="$attrs"
    type="button"
    :variant="size === 'small' ? 'subtle' : 'secondary'"
    :size
    classicon="i-lucide:download"
    :aria-expanded="isOpen"
    aria-haspopup="menu"
    :aria-controls="menuId"
    @click="toggle"
    @keydown="handleKeydown"
  >
    {{ $t('package.download.button') }}
    <span
      class="i-lucide:chevron-down ms-1"
      :class="[
        size === 'small' ? 'w-3 h-3' : 'w-3.5 h-3.5',
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
      <ul
        v-if="isOpen"
        :id="menuId"
        ref="listRef"
        role="menu"
        :aria-label="$t('package.download.button')"
        :style="getDropdownStyle()"
        class="fixed bg-bg-subtle border border-border rounded-md shadow-lg z-50"
        @keydown="handleKeydown"
      >
        <li
          v-for="(item, index) in menuItems"
          :key="item.id"
          role="menuitem"
          :aria-disabled="item.disabled || undefined"
          class="flex items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150"
          :class="[
            item.disabled
              ? 'cursor-default text-fg-muted/50'
              : highlightedIndex === index
                ? 'cursor-pointer bg-bg-elevated text-fg'
                : 'cursor-pointer text-fg-muted hover:bg-bg-elevated hover:text-fg',
          ]"
          @click="handleAction(item)"
          @mouseenter="highlightedIndex = index"
        >
          <span :class="item.icon" class="w-4 h-4" aria-hidden="true" />
          {{ $t('package.download.package') }}
        </li>
      </ul>
    </Transition>
  </Teleport>
</template>
