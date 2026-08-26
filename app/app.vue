<script setup lang="ts">
import type { Directions } from '@nuxtjs/i18n'
import { useEventListener, onKeyDown, onKeyUp } from '@vueuse/core'
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

const darkMode = usePreferredDark()
const colorMode = useColorMode()
const colorScheme = computed(() => {
  return {
    system: darkMode ? 'dark light' : 'light dark',
    light: 'only light',
    dark: 'only dark',
  }[colorMode.preference]
})

// Runs only while this root component is mounted (unlike a global plugin),
// so it doesn't interfere with component tests that mountSuspended a
// standalone component and mock useConnector for that component alone.
if (import.meta.client) {
  useLikesBadge()
}

// Keep theme-color in sync with --bg so the WCO title-bar strip (where the
// OS traffic-lights / min-max-close buttons are drawn) matches the header.
// We write directly to the <meta> DOM node rather than going through useHead
// because NuxtPwaAssets also calls useHead for theme-color, and as a child
// component it would always win the deduplication race.
if (import.meta.client) {
  let desiredThemeColor = ''

  const applyThemeColor = (color: string) => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta && meta.content !== color) meta.content = color
  }
  const readBg = () => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (!raw) return
    desiredThemeColor = raw
    applyThemeColor(raw)
  }

  onMounted(() => {
    readBg()

    // Re-apply whenever the color mode or accent changes
    new MutationObserver(readBg).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    })

    // @unhead flushes after onMounted and re-writes the meta node with the
    // PWA module's static '#0a0a0a'. Guard against that by watching the node
    // and immediately re-asserting our CSS-variable value when it changes.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (meta) {
      new MutationObserver(() => {
        if (desiredThemeColor) applyThemeColor(desiredThemeColor)
      }).observe(meta, { attributes: true, attributeFilter: ['content'] })
    }
  })
}

useHead({
  htmlAttrs: {
    'lang': () => locale.value,
    'dir': () => localeMap[locale.value] ?? 'ltr',
    'data-kbd-hints': () => showKbdHints.value,
  },
  titleTemplate: titleChunk => {
    return titleChunk ? titleChunk : 'npmx - Better npm Package Browser'
  },
  meta: [{ name: 'color-scheme', content: colorScheme }],
})

if (import.meta.server) {
  setJsonLd(createWebSiteSchema())
}

const keyboardShortcuts = useKeyboardShortcuts()
const { settings } = useSettings()

initKeyShortcuts()

onKeyDown(
  '/',
  e => {
    if (e.ctrlKey) {
      e.preventDefault()
      settings.value.instantSearch = !settings.value.instantSearch
      return
    }

    if (!keyboardShortcuts.value || isEditableElement(e.target)) return
    e.preventDefault()

    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="search"], input[name="q"]',
    )

    if (searchInput) {
      searchInput.focus()
      return
    }

    router.push({ name: 'search' })
  },
  { dedupe: true },
)

onKeyDown(
  '?',
  e => {
    if (!keyboardShortcuts.value || isEditableElement(e.target)) return
    e.preventDefault()
    showKbdHints.value = true
  },
  { dedupe: true },
)

onKeyUp(
  '?',
  e => {
    if (!keyboardShortcuts.value || isEditableElement(e.target)) return
    e.preventDefault()
    showKbdHints.value = false
  },
  { dedupe: true },
)

// Light dismiss fallback for browsers that don't support closedby="any" (Safari + old Chrome/Firefox)
// https://codepen.io/paramagicdev/pen/gbYompq
// see: https://github.com/npmx-dev/npmx.dev/pull/522#discussion_r2749978022
function handleModalLightDismiss(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'DIALOG' && target.hasAttribute('open')) {
    const rect = target.getBoundingClientRect()
    const isOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom

    if (!isOutside) return
    ;(target as HTMLDialogElement).close()
  }
}

if (import.meta.client) {
  // Feature check for native light dismiss support via closedby="any"
  // https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#closedby
  const supportsClosedBy =
    typeof HTMLDialogElement !== 'undefined' &&
    typeof HTMLDialogElement.prototype === 'object' &&
    'closedBy' in HTMLDialogElement.prototype
  if (!supportsClosedBy) {
    useEventListener(document, 'click', handleModalLightDismiss)
  }
}

const isBlogPostRoute = computed(() => {
  return route.path.startsWith('/blog/') && route.path !== '/blog/'
})

// This is a priority bug that when we set og:image at the component level via useSeoMeta,
// it is ignored and the image from app.vue is written over it.
if (!isBlogPostRoute.value) {
  // title and description will be inferred
  // this will be overridden by upstream pages that use different templates
  defineOgImage('Page.takumi', {}, { alt: 'npmx — a fast, modern browser for the npm registry' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-bg text-fg">
    <NuxtPwaAssets />
    <LinkBase to="#main-content" external variant="button-primary" class="skip-link">{{
      $t('common.skip_link')
    }}</LinkBase>

    <AppHeader :show-logo="!isHomepage" />

    <NuxtRouteAnnouncer v-slot="{ message }">
      {{ route.name === 'search' ? `${$t('search.title_packages')} - npmx` : message }}
    </NuxtRouteAnnouncer>

    <!-- In WCO mode this div becomes a fixed scroll container that starts just
         below the header, so the scrollbar never intrudes into the title bar. -->
    <div id="app-scroll" class="flex-1 flex flex-col min-h-0">
      <NuxtAnnouncer />

      <div id="main-content" class="flex-1 flex flex-col" tabindex="-1">
        <NuxtPage />
      </div>

      <AppFooter />
    </div>

    <CommandPalette />

    <PwaPrompt />

    <ScrollToTop />
  </div>
</template>

<style scoped>
/* Skip link */
.skip-link {
  position: fixed;
  top: -100%;
  z-index: 100;
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

/*
 * Window Controls Overlay — scroll container.
 *
 * In WCO mode the <header> is position:fixed, so the viewport would
 * otherwise scroll from y=0 (through the title bar). Instead we disable
 * viewport scrolling entirely and make #app-scroll a fixed element that
 * starts exactly at the header's bottom border, so the scrollbar track
 * appears only in the content area and never in the title bar.
 *
 * Header height = env(titlebar-area-y, 0px)   ← usually 0
 *               + 3.5rem (min-h-14, the nav row)
 *               + 1px   (border-bottom of the header)
 */
@media (display-mode: window-controls-overlay) {
  html,
  body {
    overflow: hidden;
    height: 100%;
    /* scrollbar-gutter: stable reserves 15 px on the right even when the
       scrollbar is gone. That gap shows up in the header border and the
       fixed #app-scroll element.  Remove the reservation in WCO mode. */
    scrollbar-gutter: auto;
  }

  #app-scroll {
    position: fixed;
    top: calc(env(titlebar-area-y, 0px) + 3.5rem + 1px);
    inset-inline: 0;
    bottom: 0;
    overflow-y: auto;
  }

  /* Page-level sticky sub-headers (e.g. PackageHeader) use top-14 to clear
     the fixed <header> when the viewport itself is the scroll container.
     #app-scroll already starts below the header here, so that offset would
     otherwise leave a redundant 3.5rem gap above them. */
  #app-scroll .sticky[class~='top-14'] {
    top: 0;
  }
}
</style>
