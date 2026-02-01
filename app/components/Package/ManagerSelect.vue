<script setup lang="ts">
import { onClickOutside, useEventListener } from '@vueuse/core'

const selectedPM = useSelectedPackageManager()

const listRef = useTemplateRef('listRef')
const triggerRef = useTemplateRef('triggerRef')
const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)

const dropdownPosition = shallowRef<{ top: number; left: number } | null>(null)

function getDropdownStyle(): Record<string, string> {
  if (!dropdownPosition.value) return {}
  return {
    top: `${dropdownPosition.value.top}px`,
    left: `${dropdownPosition.value.left}px`,
  }
}

useEventListener('scroll', close, true)

// Generate unique ID for accessibility
const inputId = useId()
const listboxId = `${inputId}-listbox`

function toggle() {
  if (isOpen.value) {
    close()
  } else {
    if (triggerRef.value) {
      const rect = triggerRef.value.getBoundingClientRect()
      dropdownPosition.value = {
        top: rect.bottom + 4,
        left: rect.left,
      }
    }
    isOpen.value = true
    highlightedIndex.value = packageManagers.findIndex(pm => pm.id === selectedPM.value)
  }
}

function close() {
  isOpen.value = false
  highlightedIndex.value = -1
}

function select(id: PackageManagerId) {
  selectedPM.value = id
  close()
  triggerRef.value?.focus()
}

// Check for reduced motion preference
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

onClickOutside(listRef, close, { ignore: [triggerRef] })
function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) return

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      highlightedIndex.value = (highlightedIndex.value + 1) % packageManagers.length
      break
    case 'ArrowUp':
      event.preventDefault()
      highlightedIndex.value =
        highlightedIndex.value <= 0 ? packageManagers.length - 1 : highlightedIndex.value - 1
      break
    case 'Enter': {
      event.preventDefault()
      const pm = packageManagers[highlightedIndex.value]
      if (pm) {
        select(pm.id)
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
    class="flex items-center gap-1.5 px-2 py-2 font-mono text-xs text-fg-muted bg-bg-subtle border border-border-subtle border-solid rounded-md transition-colors duration-150 hover:(text-fg border-border-hover) active:scale-95 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 hover:text-fg"
    :aria-expanded="isOpen"
    aria-haspopup="listbox"
    :aria-label="$t('package.get_started.pm_label')"
    :aria-controls="listboxId"
    @click="toggle"
    @keydown="handleKeydown"
  >
    <template v-for="pmOption in packageManagers" :key="pmOption.id">
      <span
        class="inline-block h-3 w-3 pm-select-content"
        :class="pmOption.icon"
        :data-pm-select="pmOption.id"
        aria-hidden="true"
      />
      <span
        class="pm-select-content"
        :data-pm-select="pmOption.id"
        :aria-hidden="pmOption.id !== selectedPM"
        >{{ pmOption.label }}</span
      >
    </template>
    <span
      class="i-carbon:chevron-down w-3 h-3"
      :class="[
        { 'rotate-180': isOpen },
        prefersReducedMotion ? '' : 'transition-transform duration-200',
      ]"
      aria-hidden="true"
    />
  </button>

  <!-- Dropdown menu (teleported to body to avoid clipping) -->
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
        :id="listboxId"
        ref="listRef"
        role="listbox"
        :aria-activedescendant="
          highlightedIndex >= 0
            ? `${listboxId}-${packageManagers[highlightedIndex]?.id}`
            : undefined
        "
        :aria-label="$t('package.get_started.pm_label')"
        :style="getDropdownStyle()"
        class="fixed bg-bg-subtle border border-border rounded-md shadow-lg z-50"
      >
        <li
          v-for="(pm, index) in packageManagers"
          :id="`${listboxId}-${pm.id}`"
          :key="pm.id"
          role="option"
          :aria-selected="selectedPM === pm.id"
          class="flex items-center gap-2 px-3 py-1.5 font-mono text-xs cursor-pointer transition-colors duration-150"
          :class="[
            selectedPM === pm.id ? 'text-fg' : 'text-fg-subtle',
            highlightedIndex === index ? 'bg-bg-elevated' : 'hover:bg-bg-elevated',
          ]"
          @click="select(pm.id)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="inline-block h-3 w-3" :class="pm.icon" aria-hidden="true" />
          <span>{{ pm.label }}</span>
          <span
            v-if="selectedPM === pm.id"
            class="i-carbon:checkmark w-3 h-3 text-accent ms-auto"
            aria-hidden="true"
          />
        </li>
      </ul>
    </Transition>
  </Teleport>
</template>

<style>
:root[data-pm] .pm-select-content {
  display: none;
}

:root[data-pm='npm'] [data-pm-select='npm'],
:root[data-pm='pnpm'] [data-pm-select='pnpm'],
:root[data-pm='yarn'] [data-pm-select='yarn'],
:root[data-pm='bun'] [data-pm-select='bun'],
:root[data-pm='deno'] [data-pm-select='deno'],
:root[data-pm='vlt'] [data-pm-select='vlt'] {
  display: inline-block;
}

/* Fallback: when no data-pm is set, npm is selected by default */
:root:not([data-pm]) .pm-select-content:not([data-pm-select='npm']) {
  display: none;
}
</style>
