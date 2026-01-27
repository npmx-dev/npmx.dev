<script setup lang="ts">
import { onKeyStroke, onClickOutside } from '@vueuse/core'

const { settings } = useSettings()
const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() =>
  locales.value.map(l => (typeof l === 'string' ? { code: l, name: l } : l)),
)

const isOpen = ref(false)
const menuRef = useTemplateRef('menuRef')
const triggerRef = useTemplateRef('triggerRef')

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

// Close on click outside
onClickOutside(menuRef, close, { ignore: [triggerRef] })

// Close on Escape
onKeyStroke('Escape', () => {
  if (isOpen.value) {
    close()
    triggerRef.value?.focus()
  }
})

// Open with comma key (global shortcut)
onKeyStroke(',', e => {
  // Don't trigger if user is typing in an input
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }
  e.preventDefault()
  triggerRef.value?.focus()
  triggerRef.value?.click()
})
</script>

<template>
  <div class="relative flex items-center">
    <button
      ref="triggerRef"
      type="button"
      class="link-subtle font-mono text-sm inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      :aria-label="$t('nav.settings')"
      aria-keyshortcuts=","
      @click="toggle"
    >
      <span class="i-carbon-settings w-4 h-4 sm:hidden" aria-hidden="true" />
      <span class="hidden sm:inline">{{ $t('nav.settings') }}</span>
      <kbd
        class="hidden sm:inline-flex items-center justify-center w-5 h-5 text-xs bg-bg-muted border border-border rounded"
        aria-hidden="true"
      >
        ,
      </kbd>
    </button>

    <!-- Settings popover -->
    <Transition
      enter-active-class="transition-opacity transition-transform duration-100 ease-out motion-reduce:transition-none"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-opacity transition-transform duration-75 ease-in motion-reduce:transition-none"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        role="menu"
        class="absolute right-0 top-full mt-2 w-64 bg-bg-elevated border border-border rounded-lg shadow-lg z-50 overflow-hidden"
      >
        <div class="px-3 py-2 border-b border-border">
          <h2 class="text-xs text-fg-subtle uppercase tracking-wider">{{ $t('nav.settings') }}</h2>
        </div>

        <div class="p-2 space-y-1">
          <!-- Relative dates toggle -->
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-bg-muted transition-[background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            role="menuitemcheckbox"
            :aria-checked="settings.relativeDates"
            @click="settings.relativeDates = !settings.relativeDates"
          >
            <span class="text-sm text-fg select-none">{{ $t('settings.relative_dates') }}</span>
            <span
              class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-[background-color] duration-200 ease-in-out motion-reduce:transition-none"
              :class="settings.relativeDates ? 'bg-fg' : 'bg-bg-subtle'"
              aria-hidden="true"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
                :class="
                  settings.relativeDates ? 'translate-x-4 bg-bg' : 'translate-x-0 bg-fg-muted'
                "
              />
            </span>
          </button>

          <!-- Include @types in install toggle -->
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-bg-muted transition-[background-color] duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
            role="menuitemcheckbox"
            :aria-checked="settings.includeTypesInInstall"
            @click="settings.includeTypesInInstall = !settings.includeTypesInInstall"
          >
            <span class="text-sm text-fg select-none">{{ $t('settings.include_types') }}</span>
            <span
              class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-[background-color] duration-200 ease-in-out motion-reduce:transition-none"
              :class="settings.includeTypesInInstall ? 'bg-fg' : 'bg-bg-subtle'"
              aria-hidden="true"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
                :class="
                  settings.includeTypesInInstall
                    ? 'translate-x-4 bg-bg'
                    : 'translate-x-0 bg-fg-muted'
                "
              />
            </span>
          </button>

          <!-- Language selector -->
          <div class="pt-2 mt-2 border-t border-border">
            <div class="px-2 py-1">
              <label for="language-select" class="text-xs text-fg-subtle uppercase tracking-wider">
                {{ $t('settings.language') }}
              </label>
            </div>
            <div class="px-2 py-1">
              <select
                id="language-select"
                :value="locale"
                class="w-full bg-bg-muted border border-border rounded-md px-2 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-fg/50 cursor-pointer"
                @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
              >
                <option v-for="loc in availableLocales" :key="loc.code" :value="loc.code">
                  {{ loc.name }}
                </option>
              </select>
            </div>
            <a
              href="https://github.com/npmx-dev/npmx.dev/tree/main/i18n/locales"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 px-2 py-1.5 text-xs text-fg-muted hover:text-fg transition-colors"
            >
              <span class="i-carbon-translate w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('settings.help_translate') }}
            </a>
          </div>
        </div>

        <div class="p-3 border-t border-border">
          <AccentColorPicker />
        </div>
      </div>
    </Transition>
  </div>
</template>
