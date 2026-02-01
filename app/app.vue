<script setup lang="ts">
import type { Directions } from '@nuxtjs/i18n'
import { useEventListener } from '@vueuse/core'
import { isEditableElement } from '~/utils/input'

const route = useRoute()
const router = useRouter()
const { locale, locales } = useI18n()

// Initialize user preferences (accent color, package manager) before hydration to prevent flash/CLS
initPreferencesOnPrehydrate()

const isHomepage = computed(() => route.name === 'index')
const showKbdHints = shallowRef(false)

const localeMap = locales.value.reduce(
  (acc, l) => {
    acc[l.code] = l.dir ?? 'ltr'
    return acc
  },
  {} as Record<string, Directions>,
)

const commandBarRef = useTemplateRef('commandBarRef')

useHead({
  htmlAttrs: {
    'lang': () => locale.value,
    'dir': () => localeMap[locale.value] ?? 'ltr',
    'data-kbd-hints': () => showKbdHints.value,
  },
  titleTemplate: titleChunk => {
    return titleChunk ? titleChunk : 'npmx - Better npm Package Browser'
  },
})

if (import.meta.server) {
  setJsonLd(createWebSiteSchema())
}

// Global keyboard shortcut:
// "/" focuses search or navigates to search page
// "?" highlights all keyboard shortcut elements
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    commandBarRef.value?.toggle()
  }

  if (isEditableElement(e.target)) return

  if (e.key === '/') {
    e.preventDefault()

    // Try to find and focus search input on current page
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="search"], input[name="q"]',
    )

    if (searchInput) {
      searchInput.focus()
      return
    }

    router.push('/search')
  }

  if (e.key === '?') {
    e.preventDefault()
    showKbdHints.value = true
  }
}

function handleGlobalKeyup() {
  showKbdHints.value = false
}

if (import.meta.client) {
  useEventListener(document, 'keydown', handleGlobalKeydown)
  useEventListener(document, 'keyup', handleGlobalKeyup)
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg text-fg">
    <NuxtPwaAssets />
    <a href="#main-content" class="skip-link font-mono">{{ $t('common.skip_link') }}</a>
    <CommandBar ref="commandBarRef" />

    <AppHeader :show-logo="!isHomepage" />

    <div id="main-content" class="flex-1 flex flex-col">
      <NuxtPage />
    </div>

    <AppFooter />

    <ScrollToTop />
  </div>
</template>

<style scoped>
/* Skip link */
.skip-link {
  position: fixed;
  top: -100%;
  inset-inline-start: 0;
  padding: 0.5rem 1rem;
  background: var(--fg);
  color: var(--bg);
  font-size: 0.875rem;
  z-index: 100;
  transition: top 0.2s ease;
}

.skip-link:hover {
  color: var(--bg);
  text-decoration: underline;
}
.skip-link:focus {
  top: 0;
}
</style>

<style>
/* Keyboard shortcut highlight on "?" key press */
kbd {
  position: relative;
}

kbd::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 0 4px 2px var(--accent);
  opacity: 0;
  transition: opacity 200ms ease-out;
  pointer-events: none;
}

html[data-kbd-hints='true'] kbd::before {
  opacity: 1;
}
</style>
