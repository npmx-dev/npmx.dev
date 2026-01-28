<script setup lang="ts">
import type { Directions, LocaleObject } from '@nuxtjs/i18n'
import { useEventListener } from '@vueuse/core'

const route = useRoute()
const router = useRouter()
const { locale, locales, t } = useI18n()

// Initialize accent color before hydration to prevent flash
initAccentOnPrehydrate()

const isHomepage = computed(() => route.path === '/')

useHead({
  titleTemplate: titleChunk => {
    return titleChunk ? titleChunk : 'npmx - Better npm Package Browser'
  },
})

const localeMap = locales.value.reduce(
  (acc, l) => {
    acc[l.code!] = l.dir ?? 'ltr'
    return acc
  },
  {} as Record<string, Directions>,
)

useHydratedHead({
  htmlAttrs: {
    lang: () => locale.value,
    dir: () => localeMap[locale.value] ?? 'ltr',
  },
})

// Global keyboard shortcut: "/" focuses search or navigates to search page
function handleGlobalKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement

  const isEditableTarget =
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

  if (isEditableTarget) {
    return
  }

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
}

if (import.meta.client) {
  useEventListener(document, 'keydown', handleGlobalKeydown)
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg text-fg">
    <a href="#main-content" class="skip-link font-mono">Skip to main content</a>

    <AppHeader :show-logo="!isHomepage" />

    <div id="main-content" class="flex-1 flex flex-col">
      <NuxtPage />
    </div>

    <AppFooter />

    <ScrollToTop />
  </div>
</template>
