<script setup lang="ts">
import { LinkBase } from '#components'
import type { NavigationConfig, NavigationConfigWithGroups } from '~/types'
import { isEditableElement } from '~/utils/input'

withDefaults(
  defineProps<{
    showLogo?: boolean
  }>(),
  {
    showLogo: true,
  },
)

const { isConnected, npmUser } = useConnector()

const desktopLinks = computed<NavigationConfig>(() => [
  {
    name: 'Compare',
    label: $t('nav.compare'),
    to: { name: 'compare' },
    keyshortcut: 'c',
    type: 'link',
    external: false,
    iconClass: 'i-carbon:compare',
  },
  {
    name: 'Settings',
    label: $t('nav.settings'),
    to: { name: 'settings' },
    keyshortcut: ',',
    type: 'link',
    external: false,
    iconClass: 'i-carbon:settings',
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
        iconClass: 'i-carbon:information',
      },
      {
        name: 'Privacy Policy',
        label: $t('privacy_policy.title'),
        to: { name: 'privacy' },
        type: 'link',
        external: false,
        iconClass: 'i-carbon:security',
      },
      {
        name: 'Accessibility',
        label: $t('a11y.title'),
        to: { name: 'accessibility' },
        type: 'link',
        external: false,
        iconClass: 'i-carbon:accessibility-alt',
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
        href: 'https://docs.npmx.dev',
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-carbon:document',
      },
      {
        name: 'Source',
        label: $t('footer.source'),
        href: 'https://repo.npmx.dev',
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-carbon:logo-github',
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
        label: $t('footer.chat'),
        href: 'https://chat.npmx.dev',
        target: '_blank',
        type: 'link',
        external: true,
        iconClass: 'i-carbon:chat',
      },
    ],
  },
])

const showFullSearch = shallowRef(false)
const showMobileMenu = shallowRef(false)
const { env } = useAppConfig().buildInfo

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

onKeyStroke(
  e => {
    if (isEditableElement(e.target)) {
      return
    }

    for (const link of desktopLinks.value) {
      if (link.to && link.keyshortcut && isKeyWithoutModifiers(e, link.keyshortcut)) {
        e.preventDefault()
        navigateTo(link.to)
        break
      }
    }
  },
  { dedupe: true },
)
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-border">
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-md" />
    <nav
      :aria-label="$t('nav.main_navigation')"
      class="relative container min-h-14 flex items-center gap-2 z-1 justify-end"
    >
      <!-- Mobile: Logo (navigates home) -->
      <NuxtLink
        v-if="!isSearchExpanded && !isOnHomePage"
        to="/"
        :aria-label="$t('header.home')"
        class="sm:hidden flex-shrink-0 font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 focus-ring"
      >
        <AppLogo class="w-8 h-8 rounded-lg" />
      </NuxtLink>

      <!-- Desktop: Logo (navigates home) -->
      <div v-if="showLogo" class="hidden sm:flex flex-shrink-0 items-center">
        <NuxtLink
          :to="{ name: 'index' }"
          :aria-label="$t('header.home')"
          dir="ltr"
          class="relative inline-flex items-center gap-1 header-logo font-mono text-lg font-medium text-fg hover:text-fg/90 transition-colors duration-200 rounded"
        >
          <AppLogo class="w-7 h-7 rounded-lg" />
          <span class="pb-0.5">npmx</span>
          <span
            aria-hidden="true"
            class="scale-35 transform-origin-br font-mono tracking-wide text-accent absolute bottom-0.5 -inset-ie-1"
          >
            {{ env === 'release' ? 'alpha' : env }}
          </span>
        </NuxtLink>
      </div>
      <!-- Spacer when logo is hidden on desktop -->
      <span v-else class="hidden sm:block w-1" />

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
      <div class="hidden sm:flex flex-shrink-0">
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
        class="sm:hidden ms-auto"
        :aria-label="$t('nav.tap_to_search')"
        :aria-expanded="showMobileMenu"
        @click="expandMobileSearch"
        v-if="!isSearchExpanded && !isOnHomePage"
        classicon="i-carbon:search"
      />

      <!-- Mobile: Menu button (always visible, click to open menu) -->
      <ButtonBase
        type="button"
        class="sm:hidden"
        :aria-label="$t('nav.open_menu')"
        :aria-expanded="showMobileMenu"
        @click="showMobileMenu = !showMobileMenu"
        classicon="i-carbon:menu"
      />
    </nav>

    <!-- Mobile menu -->
    <HeaderMobileMenu :links="mobileLinks" v-model:open="showMobileMenu" />
  </header>
</template>
