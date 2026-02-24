<script setup lang="ts">
import type { SlimPackumentVersion, InstallSizeResult } from '#shared/types'
import { onClickOutside, useEventListener } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    packageName: string
    version: SlimPackumentVersion
    installSize: InstallSizeResult | null
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
const dropdownPosition = shallowRef<{ top: number; right: number } | null>(null)

const { t } = useI18n()
const menuId = useId()
const menuItems = computed(() => [
  { id: 'package', label: t('package.download.package'), icon: 'i-lucide:package' },
  { id: 'dependencies', label: t('package.download.dependencies'), icon: 'i-lucide:list-tree' },
])

function getDropdownStyle(): Record<string, string> {
  if (!dropdownPosition.value) return {}
  return {
    top: `${dropdownPosition.value.top}px`,
    right: `${document.documentElement.clientWidth - dropdownPosition.value.right}px`,
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
        right: rect.right,
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
      handleAction(menuItems.value[highlightedIndex.value]?.id)
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

function handleAction(id: string | undefined) {
  if (id === 'package') {
    downloadPackage()
  } else if (id === 'dependencies') {
    downloadDependenciesScript()
  }
  close()
}

async function downloadPackage() {
  const tarballUrl = props.version.dist.tarball
  if (!tarballUrl) return

  try {
    const response = await fetch(tarballUrl)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to download package:', error)
    // Fallback to direct link for non-CORS or other issues, though download attribute may be ignored
    const link = document.createElement('a')
    link.href = tarballUrl
    link.download = `${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

function downloadDependenciesScript() {
  if (!props.installSize) return

  const lines = [
    '#!/bin/bash',
    `# Download dependencies for ${props.packageName}@${props.version.version}`,
    'mkdir -p node_modules',
    '',
  ]

  // Add root package
  const rootTarball = props.version.dist.tarball
  if (rootTarball) {
    lines.push(`# ${props.packageName}@${props.version.version}`)
    lines.push(
      `curl -L "${rootTarball}" -o "${props.packageName.replace(/\//g, '__')}-${props.version.version}.tgz"`,
    )
  }

  // Add dependencies
  props.installSize.dependencies.forEach(dep => {
    if (!dep.tarballUrl) return
    lines.push(`# ${dep.name}@${dep.version}`)
    lines.push(
      `curl -L "${dep.tarballUrl}" -o "${dep.name.replace(/\//g, '__')}-${dep.version}.tgz"`,
    )
  })

  const blob = new Blob([lines.join('\n')], { type: 'text/x-shellscript' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `download-${props.packageName.replace(/\//g, '__')}-deps.sh`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

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
    :size="size"
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
      <div
        v-if="isOpen"
        :id="menuId"
        ref="listRef"
        role="menu"
        :style="getDropdownStyle()"
        class="fixed bg-bg-subtle border border-border rounded-md shadow-lg z-50 py-1 w-64 overscroll-contain"
        @keydown="handleKeydown"
      >
        <button
          v-for="(item, index) in menuItems"
          :key="item.id"
          role="menuitem"
          type="button"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-fg-muted transition-colors duration-150"
          :class="[
            highlightedIndex === index
              ? 'bg-bg-elevated text-fg'
              : 'hover:bg-bg-elevated hover:text-fg',
          ]"
          @click="handleAction(item.id)"
          @mouseenter="highlightedIndex = index"
        >
          <span :class="item.icon" class="w-4 h-4" aria-hidden="true" />
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>
