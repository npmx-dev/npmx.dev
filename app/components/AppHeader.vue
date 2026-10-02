<script setup lang="ts">
import { LinkBase } from '#components'
import type { NavigationConfig, NavigationConfigWithGroups } from '~/types'
import { NPMX_DOCS_SITE } from '#shared/utils/constants'

const discord = useDiscordLink()
const { open: openCommandPalette } = useCommandPalette()
const { commandPaletteShortcutLabel } = usePlatformModifierKey()

withDefaults(
  defineProps<{
    showLogo?: boolean
  }>(),
  {
    showLogo: true,
  },
)

const { isConnected, npmUser } = useConnector()

const { packageName } = usePackageRoute()

const compareTarget = computed(() =>
  packageName.value
    ? { name: 'compare' as const, query: { packages: packageName.value } }
    : { name: 'compare' as const },
)

const desktopLinks = computed<NavigationConfig>(() => [
  {
    name: 'Compare',
    label: $t('nav.compare'),
    to: compareTarget.value,
    keyshortcut: 'c',
    type: 'link',
    external: false,
    iconClass: 'i-lucide:git-compare',
  },
  {
    name: 'Settings',
    label: $t('nav.settings'),
    to: { name: 'settings' },
    keyshortcut: ',',
    type: 'link',
    external: false,
    iconClass: 'i-lucide:settings',
  },
])

const mobileLinks = computed<NavigationConfigWithGroups>(() => [
  {
    name: 'Desktop Links',
    type: 'group',
    items: [...desktopLinks.value],
  },
  {
    type: 'separator',
  },
  {
    name: 'About & Policies',
    type: 'group',
    items: [
      {
        name: 'About',
        label: $t('footer.about'),
        to: { name: 'about' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:info',
      },
      {
        name: 'Blog',
        label: $t('footer.blog'),
        to: { name: 'blog' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:notebook-pen',
      },
      {
        name: 'Privacy Policy',
        label: $t('privacy_policy.title'),
        to: { name: 'privacy' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:shield-check',
      },
      {
        name: 'Accessibility',
        label: $t('a11y.title'),
        to: { name: 'accessibility' },
        type: 'link',
        external: false,
        iconClass: 'i-custom:a11y',
      },
      {
        name: 'Translation Status',
        label: $t('translation_status.title'),
        to: { name: 'translation-status' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:languages',
      },
      {
        name: 'Brand',
        label: $t('footer.brand'),
        to: { name: 'brand' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:palette',
      },
      {
        name: 'Noodles',
        label: $t('noodles.title'),
        to: { name: 'noodles' },
        type: 'link',
        external: false,
        iconClass: 'i-lucide:soup',
      },
    ],
  },
  {
    type: 'separator',
  },
  {
    name: 'External Links',
    type: 'group',
    label: $t('nav.links'),
    items: [
      {
        name: 'Docs',
        label: $t('footer.docs'),
        href: NPMX_DOCS_SITE,
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-lucide:file-text',
      },
      {
        name: 'Source',
        label: $t('footer.source'),
        href: 'https://repo.npmx.dev',
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-simple-icons:github',
      },
      {
        name: 'Social',
        label: $t('footer.social'),
        href: 'https://social.npmx.dev',
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-simple-icons:bluesky',
      },
      {
        name: 'Chat',
        label: discord.value.label,
        href: discord.value.url,
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-lucide:message-circle',
      },
    ],
  },
])

const showFullSearch = shallowRef(false)
const showMobileMenu = shallowRef(false)
const { env, prNumber } = useAppConfig().buildInfo

// On mobile, clicking logo+search button expands search
const route = useRoute()
const isMobile = useIsMobile()
const isSearchExpandedManually = shallowRef(false)
const searchBoxRef = useTemplateRef('searchBoxRef')

// On search page, always show search expanded on mobile
const isOnHomePage = computed(() => route.name === 'index')
const isOnSearchPage = computed(() => route.name === 'search')
const isSearchExpanded = computed(() => isOnSearchPage.value || isSearchExpandedManually.value)

function expandMobileSearch() {
  isSearchExpandedManually.value = true
  nextTick(() => {
    searchBoxRef.value?.focus()
  })
}

watch(
  isOnSearchPage,
  visible => {
    if (!visible) return

    searchBoxRef.value?.focus()
    nextTick(() => {
      searchBoxRef.value?.focus()
    })
  },
  { flush: 'sync' },
)

function handleSearchBlur() {
  showFullSearch.value = false
  // Collapse expanded search on mobile after blur (with delay for click handling)
  // But don't collapse if we're on the search page
  if (isMobile.value && !isOnSearchPage.value) {
    setTimeout(() => {
      isSearchExpandedManually.value = false
    }, 150)
  }
}

function handleSearchFocus() {
  showFullSearch.value = true
}

useShortcuts({
  'c': () => compareTarget.value,
  ',': () => ({ name: 'settings' }),
})
</script>

<style scoped>
/*
 * Window Controls Overlay — moves the app header into the installed PWA title
 * bar, making the chrome controls (close/min/max) sit flush with the header.
 *
 * env(titlebar-area-x)     — horizontal start after macOS traffic lights (0 on Windows)
 * env(titlebar-area-y)     — vertical offset from viewport top (usually 0)
 * env(titlebar-area-width) — usable width (viewport minus controls on both sides)
 *
 * header has `drag` so the full strip is a window-move target.
 * Interactive descendants each declare `no-drag`; the gaps between them
 * inherit `drag` from the header and act as the drag handle.
 */
@media (display-mode: window-controls-overlay) {
  header {
    position: fixed;
    inset-inline: 0;
    top: 0;
    padding-top: env(titlebar-area-y, 0px);
    -webkit-app-region: drag;
    app-region: drag;
  }

  /* Solid, opaque background so the web content matches the OS title-bar color
     and scrolling content cannot bleed through the translucent layer. */
  header > div {
    background-color: var(--bg);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  nav {
    /* Span the full header width so the inline padding can reference 100% = viewport */
    max-width: 100%;
    margin-inline: 0;
    /* Two-value shorthand in one declaration beats the container class's padding-inline.
       Left:  macOS traffic-lights width (0 on Windows).
       Right: Windows min/max/close width (0 on macOS). */
    padding-inline: env(titlebar-area-x, 0px)
      calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%));
  }

  /* Every interactive descendant must cancel the inherited drag so it stays clickable */
  header :deep(:is(a, button, input, select, [role='button'], [role='combobox'])) {
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }
}
</style>

<template>
  <header class="sticky top-0 z-50 border-b border-border">
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-md" />
    <nav
      :aria-label="$t('nav.main_navigation')"
      class="relative container min-h-14 flex items-center gap-2 z-1 justify-end"
    >
      <!-- Mobile: Logo (navigates home) -->
      <LogoContextMenu v-if="!isSearchExpanded && !isOnHomePage" class="sm:hidden flex-shrink-0">
        <NuxtLink
          to="/"
          :aria-label="$t('header.home')"
          class="font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 focus-ring me-4"
        >
          <AppMark class="w-6 h-auto" />
        </NuxtLink>
      </LogoContextMenu>

      <!-- Desktop: Logo (navigates home) -->
      <LogoContextMenu v-if="showLogo" class="hidden sm:flex flex-shrink-0 items-center">
        <NuxtLink
          :to="{ name: 'index' }"
          :aria-label="$t('header.home')"
          dir="ltr"
          class="relative inline-flex items-center gap-1 py-2 header-logo font-mono text-lg font-medium text-fg hover:text-fg/90 transition-colors duration-200 me-4"
        >
          <AppLogo class="h-4.5 w-auto" />
          <span
            aria-hidden="true"
            class="scale-35 transform-origin-br font-mono tracking-wide text-accent absolute bottom-0.75 -inset-ie-1"
          >
            {{ env === 'release' ? 'alpha' : env }}
          </span>
        </NuxtLink>
      </LogoContextMenu>

      <NuxtLink
        v-if="showLogo && !isSearchExpanded && prNumber"
        :to="`https://github.com/npmx-dev/npmx.dev/pull/${prNumber}`"
        :aria-label="$t('header.pr', { prNumber })"
      >
        <span class="text-xs px-1.5 py-0.5 rounded badge-green font-sans font-medium">
          PR #{{ prNumber }}
        </span>
      </NuxtLink>

      <!-- Spacer when logo is hidden on desktop -->
      <span v-else class="hidden sm:block w-1" />

      <ButtonBase
        type="button"
        variant="secondary"
        class="hidden lg:inline-flex shrink-0 gap-2 ps-2.5 pe-1.25 py-1.25! me-3"
        :aria-label="$t('shortcuts.command_palette')"
        :title="$t('shortcuts.command_palette_description', { ctrlKey: $t('shortcuts.ctrl_key') })"
        @click="openCommandPalette"
      >
        <span>{{ $t('command_palette.quick_actions') }}</span>
        <span class="inline-flex items-center gap-1 text-xs text-fg-subtle">
          <kbd
            class="inline-flex items-center justify-center rounded border border-border bg-bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-fg-muted"
          >
            {{ commandPaletteShortcutLabel }}
          </kbd>
        </span>
      </ButtonBase>

      <!-- Center: Search bar + nav items -->
      <div
        class="flex-1 flex items-center md:gap-6"
        :class="{
          'hidden sm:flex': !isSearchExpanded,
          'justify-end': isOnHomePage,
          'justify-center': !isOnHomePage,
        }"
      >
        <!-- Search bar (hidden on mobile unless expanded) -->
        <HeaderSearchBox
          ref="searchBoxRef"
          :inputClass="isSearchExpanded ? 'w-full' : ''"
          :class="{ 'max-w-md': !isSearchExpanded }"
          @focus="handleSearchFocus"
          @blur="handleSearchBlur"
        />
        <ul
          v-if="!isSearchExpanded && isConnected && npmUser"
          :class="{ hidden: showFullSearch }"
          class="hidden sm:flex items-center gap-4 sm:gap-6 list-none m-0 p-0"
        >
          <!-- Packages dropdown (when connected) -->
          <li v-if="isConnected && npmUser" class="flex items-center">
            <HeaderPackagesDropdown :username="npmUser" />
          </li>

          <!-- Orgs dropdown (when connected) -->
          <li v-if="isConnected && npmUser" class="flex items-center">
            <HeaderOrgsDropdown :username="npmUser" />
          </li>
        </ul>
      </div>

      <!-- End: Desktop nav items + Mobile menu button -->
      <div class="hidden sm:flex flex-shrink-0 items-center gap-2">
        <!-- Desktop: Explore link -->
        <LinkBase
          v-for="link in desktopLinks"
          :key="link.name"
          class="border-none"
          variant="button-secondary"
          :to="link.to"
          :aria-keyshortcuts="link.keyshortcut"
        >
          {{ link.label }}
        </LinkBase>

        <HeaderAccountMenu />
      </div>

      <!-- Mobile: Search button (expands search) -->
      <ButtonBase
        type="button"
        class="sm:hidden ms-auto py-2.5!"
        :aria-label="$t('nav.tap_to_search')"
        :aria-expanded="showMobileMenu"
        @click="expandMobileSearch"
        v-if="!isSearchExpanded && !isOnHomePage"
        classicon="i-lucide:search"
      />

      <!-- Mobile: Menu button (always visible, click to open menu) -->
      <ButtonBase
        type="button"
        class="sm:hidden py-2.5!"
        :aria-label="$t('nav.open_menu')"
        :aria-expanded="showMobileMenu"
        @click="showMobileMenu = !showMobileMenu"
        classicon="i-lucide:menu"
      />
    </nav>

    <!-- Mobile menu -->
    <HeaderMobileMenu :links="mobileLinks" v-model:open="showMobileMenu" />
  </header>
</template>
