<script setup lang="ts">
import type { MenuDropdownItem, NavigationConfig, NavigationConfigWithGroups } from '~/types'
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

const featureItems = computed<MenuDropdownItem[]>(() => [
  {
    type: 'link',
    icon: 'i-lucide:git-compare',
    title: $t('nav.compare'),
    description: $t('nav.compare_desc'),
    shortcut: 'c',
    href: compareTarget.value,
  },
  {
    type: 'link',
    icon: 'i-lucide:settings',
    title: $t('nav.settings'),
    description: $t('nav.settings_desc'),
    shortcut: ',',
    href: { name: 'settings' },
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

<template>
  <header class="sticky top-0 z-50 border-b border-border">
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-md" />
    <nav
      :aria-label="$t('nav.main_navigation')"
      class="relative container min-h-14 flex items-center gap-2 z-1 justify-end"
    >
      <!-- Group 1: Logo -->
      <div class="flex items-center flex-shrink-0">
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
      </div>

      <!-- Group 2: Search + jump to -->
      <div
        class="flex-1 flex items-center gap-2"
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

        <ButtonBase
          type="button"
          variant="secondary"
          class="hidden lg:inline-flex shrink-0 gap-2 ps-2.5 pe-1.25 py-1.5!"
          :aria-label="$t('shortcuts.command_palette')"
          :title="
            $t('shortcuts.command_palette_description', { ctrlKey: $t('shortcuts.ctrl_key') })
          "
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
      </div>

      <!-- Group 3: Features + connect -->
      <div class="hidden sm:flex flex-shrink-0 items-center gap-1">
        <MenuDropdown :items="featureItems">
          <template #trigger="{ open, toggle }">
            <ButtonBase
              type="button"
              class="border-none"
              :aria-expanded="open"
              aria-haspopup="true"
              @click="toggle"
            >
              {{ $t('nav.features') }}
              <span
                class="i-lucide:chevron-down w-3 h-3 transition-transform duration-200"
                :class="{ 'rotate-180': open }"
                aria-hidden="true"
              />
            </ButtonBase>
          </template>
        </MenuDropdown>

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
