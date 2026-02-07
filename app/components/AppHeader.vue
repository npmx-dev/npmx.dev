<script setup lang="ts">
import { LinkBase } from '#components'
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

const showFullSearch = shallowRef(false)
const showMobileMenu = shallowRef(false)

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
  e => isKeyWithoutModifiers(e, ',') && !isEditableElement(e.target),
  e => {
    e.preventDefault()
    navigateTo({ name: 'settings' })
  },
  { dedupe: true },
)

onKeyStroke(
  e =>
    isKeyWithoutModifiers(e, 'c') &&
    !isEditableElement(e.target) &&
    // Allow more specific handlers to take precedence
    !e.defaultPrevented,
  e => {
    e.preventDefault()
    navigateTo({ name: 'compare' })
  },
  { dedupe: true },
)
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-border">
    <div class="absolute inset-0 bg-bg/80 backdrop-blur-md" />
    <nav
      :aria-label="$t('nav.main_navigation')"
      class="relative container min-h-14 flex items-center gap-2 z-1"
      :class="isOnHomePage ? 'justify-end' : 'justify-between'"
    >
      <!-- Mobile: Logo + search button (expands search, doesn't navigate) -->
      <button
        v-if="!isSearchExpanded && !isOnHomePage"
        type="button"
        class="sm:hidden flex-shrink-0 inline-flex items-center gap-2 font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 rounded"
        :aria-label="$t('nav.tap_to_search')"
        @click="expandMobileSearch"
      >
        <AppLogo class="w-8 h-8 rounded-lg" />
        <span class="i-carbon:search w-4 h-4 text-fg-subtle" aria-hidden="true" />
      </button>

      <!-- Desktop: Logo (navigates home) -->
      <div v-if="showLogo" class="hidden sm:flex flex-shrink-0 items-center">
        <NuxtLink
          :to="{ name: 'index' }"
          :aria-label="$t('header.home')"
          dir="ltr"
          class="inline-flex items-center gap-1 header-logo font-mono text-lg font-medium text-fg hover:text-fg/90 transition-colors duration-200 rounded"
        >
          <AppLogo class="w-8 h-8 rounded-lg" />
          <span>npmx</span>
        </NuxtLink>
      </div>
      <!-- Spacer when logo is hidden on desktop -->
      <span v-else class="hidden sm:block w-1" />

      <!-- Center: Search bar + nav items -->
      <div
        class="flex-1 flex items-center justify-center md:gap-6"
        :class="{ 'hidden sm:flex': !isSearchExpanded }"
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
        <!-- Desktop: Compare link -->
        <LinkBase
          class="border-none"
          variant="button-secondary"
          :to="{ name: 'compare' }"
          keyshortcut="c"
        >
          {{ $t('nav.compare') }}
        </LinkBase>

        <!-- Desktop: Settings link -->
        <LinkBase
          class="border-none"
          variant="button-secondary"
          :to="{ name: 'settings' }"
          keyshortcut=","
        >
          {{ $t('nav.settings') }}
        </LinkBase>

        <HeaderAccountMenu />
      </div>

      <!-- Mobile: Menu button (always visible, click to open menu) -->
      <ButtonBase
        type="button"
        class="sm:hidden flex"
        :aria-label="$t('nav.open_menu')"
        :aria-expanded="showMobileMenu"
        @click="showMobileMenu = !showMobileMenu"
        classicon="i-carbon:menu"
      />
    </nav>

    <!-- Mobile menu -->
    <HeaderMobileMenu v-model:open="showMobileMenu" />
  </header>
</template>
