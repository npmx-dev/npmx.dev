<script setup lang="ts">
import { debounce } from 'perfect-debounce'

withDefaults(
  defineProps<{
    showLogo?: boolean
    showConnector?: boolean
  }>(),
  {
    showLogo: true,
    showConnector: true,
  },
)

const { isConnected, npmUser } = useConnector()

const router = useRouter()
const route = useRoute()

const searchQuery = ref('')
const isSearchFocused = ref(false)

const showSearchBar = computed(() => {
  return route.name !== 'search' && route.name !== 'index'
})

const debouncedNavigate = debounce(async () => {
  const query = searchQuery.value.trim()
  await router.push({
    name: 'search',
    query: query ? { q: query } : undefined,
  })
  searchQuery.value = ''
}, 100)

async function handleSearchInput() {
  debouncedNavigate()
}

onKeyStroke(',', e => {
  // Don't trigger if user is typing in an input
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  e.preventDefault()
  router.push('/settings')
})
</script>

<template>
  <header
    :aria-label="$t('header.site_header')"
    class="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border"
  >
    <nav :aria-label="$t('nav.main_navigation')" class="container h-14 flex items-center">
      <!-- Left: Logo -->
      <div class="flex-shrink-0">
        <NuxtLink
          v-if="showLogo"
          to="/"
          :aria-label="$t('header.home')"
          class="header-logo font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 focus-ring rounded"
        >
          <span class="text-accent"><span class="-tracking-0.2em">.</span>/</span>npmx
        </NuxtLink>
        <!-- Spacer when logo is hidden -->
        <span v-else class="w-1" />
      </div>

      <!-- Center: Search bar + nav items -->
      <div class="flex-1 flex items-center justify-center gap-4 sm:gap-6">
        <!-- Search bar (shown on all pages except home and search) -->
        <search v-if="showSearchBar" class="hidden sm:block flex-1 max-w-md">
          <form
            role="search"
            method="GET"
            action="/search"
            class="relative"
            @submit.prevent="handleSearchInput"
          >
            <label for="header-search" class="sr-only">
              {{ $t('search.label') }}
            </label>

            <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
              <div class="search-box relative flex items-center">
                <span
                  class="absolute left-3 text-fg-subtle font-mono text-sm pointer-events-none transition-colors duration-200 motion-reduce:transition-none group-focus-within:text-accent z-1"
                >
                  /
                </span>

                <input
                  id="header-search"
                  v-model="searchQuery"
                  type="search"
                  name="q"
                  :placeholder="$t('search.placeholder')"
                  v-bind="noCorrect"
                  class="w-full bg-bg-subtle border border-border rounded-md pl-7 pr-3 py-1.5 font-mono text-sm text-fg placeholder:text-fg-subtle transition-border-color duration-300 motion-reduce:transition-none focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                  @input="handleSearchInput"
                  @focus="isSearchFocused = true"
                  @blur="isSearchFocused = false"
                />
                <button type="submit" class="sr-only">{{ $t('search.button') }}</button>
              </div>
            </div>
          </form>
        </search>

        <ul class="flex items-center gap-4 sm:gap-6 list-none m-0 p-0">
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

      <!-- Right: User status + GitHub -->
      <div class="flex-shrink-0 flex items-center gap-4 sm:gap-6 ml-auto sm:ml-0">
        <NuxtLink
          to="/about"
          class="sm:hidden link-subtle font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
        >
          {{ $t('footer.about') }}
        </NuxtLink>

        <NuxtLink
          to="/settings"
          class="link-subtle font-mono text-sm inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
          aria-keyshortcuts=","
        >
          {{ $t('nav.settings') }}
          <kbd
            class="hidden sm:inline-flex items-center justify-center w-5 h-5 text-xs bg-bg-muted border border-border rounded"
            aria-hidden="true"
          >
            ,
          </kbd>
        </NuxtLink>

        <div v-if="showConnector" class="hidden sm:block">
          <ConnectorStatus />
        </div>
      </div>
    </nav>
  </header>
</template>
