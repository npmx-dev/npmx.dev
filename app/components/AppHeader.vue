<script setup lang="ts">
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

const showFullSearch = ref(false)

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
  <header class="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border">
    <nav
      :aria-label="$t('nav.main_navigation')"
      class="container h-14 flex items-center justify-start"
    >
      <!-- Start: Logo -->
      <div :class="{ 'hidden sm:block': showFullSearch }" class="flex-shrink-0">
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
      <div class="flex-1 flex items-center justify-center md:gap-6 mx-2">
        <!-- Search bar (shown on all pages except home) -->
        <SearchBox
          :inputClass="showFullSearch ? '' : 'max-w[6rem]'"
          @focus="showFullSearch = true"
          @blur="showFullSearch = false"
        />
        <ul
          :class="{ 'hidden sm:flex': showFullSearch }"
          class="flex items-center gap-4 sm:gap-6 list-none m-0 p-0"
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

      <!-- End: User status + GitHub -->
      <div
        :class="{ 'hidden sm:flex': showFullSearch }"
        class="flex-shrink-0 flex items-center gap-4 sm:gap-6 ms-auto sm:ms-0"
      >
        <NuxtLink
          to="/compare"
          class="hidden sm:inline-flex link-subtle font-mono text-sm items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded"
        >
          <span class="i-carbon-compare w-4 h-4" aria-hidden="true" />
          {{ $t('nav.compare') }}
        </NuxtLink>

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
