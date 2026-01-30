<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

const selectedPM = useSelectedPackageManager()

const listRef = useTemplateRef('listRef')
const triggerRef = useTemplateRef('triggerRef')
const isOpen = shallowRef(false)
const highlightedIndex = shallowRef(-1)

// Generate unique ID for accessibility
const inputId = useId()
const listboxId = `${inputId}-listbox`

const pm = computed(() => {
  return packageManagers.find(p => p.id === selectedPM.value) ?? packageManagers[0]
})

function toggle() {
  if (isOpen.value) {
    close()
  } else {
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
  <div class="relative">
    <button
      ref="triggerRef"
      type="button"
      class="inline-flex items-center gap-1 px-2 py-1 font-mono text-xs text-fg-muted bg-bg-subtle/80 border border-border rounded transition-colors duration-200 hover:(text-fg border-border-hover) active:scale-95 focus:border-border-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      :aria-label="$t('settings.package_manager')"
      :aria-controls="listboxId"
      @click="toggle"
      @keydown="handleKeydown"
    >
      <ClientOnly>
        <span class="inline-block h-3 w-3" :class="pm.icon" aria-hidden="true" />
        <span>{{ pm.label }}</span>
        <template #fallback>
          <span class="inline-block h-3 w-3 i-simple-icons:npm" aria-hidden="true" />
          <span>npm</span>
        </template>
      </ClientOnly>
      <span
        class="i-carbon-chevron-down w-3 h-3"
        :class="[
          { 'rotate-180': isOpen },
          prefersReducedMotion ? '' : 'transition-transform duration-200',
        ]"
        aria-hidden="true"
      />
    </button>

    <!-- Dropdown menu -->
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
        :aria-label="$t('settings.package_manager')"
        class="absolute right-0 top-full mt-1 min-w-28 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 overflow-hidden py-1"
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
            highlightedIndex === index ? 'bg-bg-subtle' : 'hover:bg-bg-subtle',
          ]"
          @click="select(pm.id)"
          @mouseenter="highlightedIndex = index"
        >
          <span class="inline-block h-3 w-3 shrink-0" :class="pm.icon" aria-hidden="true" />
          <span>{{ pm.label }}</span>
          <span
            v-if="selectedPM === pm.id"
            class="i-carbon-checkmark w-3 h-3 text-accent ml-auto shrink-0"
            aria-hidden="true"
          />
        </li>
      </ul>
    </Transition>
  </div>
</template>
