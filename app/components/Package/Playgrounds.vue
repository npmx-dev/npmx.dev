<script setup lang="ts">
import type { PlaygroundLink } from '#shared/types'
import { decodeHtmlEntities } from '~/utils/formatters'

const props = defineProps<{
  links: PlaygroundLink[]
}>()

// Map provider id to icon class
const providerIcons: Record<string, string> = {
  'stackblitz': 'i-simple-icons:stackblitz',
  'codesandbox': 'i-simple-icons:codesandbox',
  'codepen': 'i-simple-icons:codepen',
  'replit': 'i-simple-icons:replit',
  'gitpod': 'i-simple-icons:gitpod',
  'vue-playground': 'i-simple-icons:vuedotjs',
  'nuxt-new': 'i-simple-icons:nuxtdotjs',
  'vite-new': 'i-simple-icons:vite',
  'jsfiddle': 'i-carbon:code',
}

// Map provider id to color class
const providerColors: Record<string, string> = {
  'stackblitz': 'text-provider-stackblitz',
  'codesandbox': 'text-provider-codesandbox',
  'codepen': 'text-provider-codepen',
  'replit': 'text-provider-replit',
  'gitpod': 'text-provider-gitpod',
  'vue-playground': 'text-provider-vue',
  'nuxt-new': 'text-provider-nuxt',
  'vite-new': 'text-provider-vite',
  'jsfiddle': 'text-provider-jsfiddle',
}

function getIcon(provider: string): string {
  return providerIcons[provider] || 'i-carbon:play'
}

function getColor(provider: string): string {
  return providerColors[provider] || 'text-fg-muted'
}

// Dropdown state
const isOpen = shallowRef(false)
const dropdownRef = useTemplateRef('dropdownRef')
const menuRef = useTemplateRef('menuRef')
const focusedIndex = shallowRef(-1)

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

// Single vs multiple
const hasSingleLink = computed(() => props.links.length === 1)
const hasMultipleLinks = computed(() => props.links.length > 1)
const firstLink = computed(() => props.links[0])

function closeDropdown() {
  isOpen.value = false
  focusedIndex.value = -1
}

function handleKeydown(event: KeyboardEvent) {
  if (!isOpen.value) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      isOpen.value = true
      focusedIndex.value = 0
      nextTick(() => focusMenuItem(0))
    }
    return
  }

  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closeDropdown()
      break
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = (focusedIndex.value + 1) % props.links.length
      focusMenuItem(focusedIndex.value)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = focusedIndex.value <= 0 ? props.links.length - 1 : focusedIndex.value - 1
      focusMenuItem(focusedIndex.value)
      break
    case 'Home':
      event.preventDefault()
      focusedIndex.value = 0
      focusMenuItem(0)
      break
    case 'End':
      event.preventDefault()
      focusedIndex.value = props.links.length - 1
      focusMenuItem(props.links.length - 1)
      break
    case 'Tab':
      closeDropdown()
      break
  }
}

function focusMenuItem(index: number) {
  const items = menuRef.value?.querySelectorAll<HTMLElement>('[role="menuitem"]')
  items?.[index]?.focus()
}
</script>

<template>
  <section v-if="links.length > 0" class="px-1">
    <h2 id="playgrounds-heading" class="text-xs text-fg-subtle uppercase tracking-wider mb-3">
      {{ $t('package.playgrounds.title') }}
    </h2>

    <div ref="dropdownRef" class="relative">
      <!-- Single link: direct button -->
      <TooltipApp v-if="hasSingleLink && firstLink" :text="firstLink.providerName" class="w-full">
        <a
          :href="firstLink.url"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full flex items-center gap-2 px-3 py-2 text-sm font-mono bg-bg-muted border border-border rounded-md hover:border-border-hover hover:bg-bg-elevated focus-visible:outline-accent/70 transition-colors duration-200"
        >
          <span
            :class="[getIcon(firstLink.provider), getColor(firstLink.provider), 'w-4 h-4 shrink-0']"
            aria-hidden="true"
          />
          <span class="truncate text-fg-muted">{{ decodeHtmlEntities(firstLink.label) }}</span>
        </a>
      </TooltipApp>

      <!-- Multiple links: dropdown button -->
      <button
        v-if="hasMultipleLinks"
        type="button"
        aria-haspopup="true"
        :aria-expanded="isOpen"
        class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-mono bg-bg-muted border border-border rounded-md hover:border-border-hover hover:bg-bg-elevated focus-visible:outline-accent/70 transition-colors duration-200"
        @click="isOpen = !isOpen"
        @keydown="handleKeydown"
      >
        <span class="flex items-center gap-2">
          <span class="i-carbon:play w-4 h-4 shrink-0 text-fg-muted" aria-hidden="true" />
          <span class="text-fg-muted"
            >{{ $t('package.playgrounds.choose') }} ({{ links.length }})</span
          >
        </span>
        <span
          class="i-carbon:chevron-down w-3 h-3 text-fg-subtle transition-transform duration-200 motion-reduce:transition-none"
          :class="{ 'rotate-180': isOpen }"
          aria-hidden="true"
        />
      </button>

      <!-- Dropdown menu -->
      <Transition
        enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
        enter-from-class="opacity-0 scale-95 motion-reduce:scale-100"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95 motion-reduce:scale-100"
      >
        <div
          v-if="isOpen && hasMultipleLinks"
          ref="menuRef"
          role="menu"
          class="absolute top-full inset-is-0 inset-ie-0 mt-1 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 py-1 overflow-visible"
          @keydown="handleKeydown"
        >
          <TooltipApp v-for="link in links" :key="link.url" :text="link.providerName" class="block">
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              class="flex items-center gap-2 px-3 py-2 text-sm font-mono text-fg-muted hover:text-fg hover:bg-bg-muted focus-visible:outline-accent/70 focus-visible:text-fg focus-visible:bg-bg-muted transition-colors duration-150"
              @click="closeDropdown"
            >
              <span
                :class="[getIcon(link.provider), getColor(link.provider), 'w-4 h-4 shrink-0']"
                aria-hidden="true"
              />
              <span class="truncate">{{ decodeHtmlEntities(link.label) }}</span>
            </a>
          </TooltipApp>
        </div>
      </Transition>
    </div>
  </section>
</template>
