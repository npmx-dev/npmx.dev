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
</script>

<template>
  <header class="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border">
    <nav aria-label="Main navigation" class="container h-14 flex items-center">
      <!-- Left: Logo -->
      <div class="flex-shrink-0">
        <NuxtLink
          v-if="showLogo"
          to="/"
          aria-label="npmx home"
          class="header-logo font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 focus-ring rounded"
        >
          <span class="text-fg-subtle"><span style="letter-spacing: -0.2em">.</span>/</span>npmx
        </NuxtLink>
        <span v-else class="w-1" />
      </div>

      <!-- Center: Main nav items -->
      <ul class="flex-1 flex items-center justify-center gap-4 sm:gap-6 list-none m-0 p-0">
        <li class="flex items-center">
          <NuxtLink
            to="/search"
            class="link-subtle font-mono text-sm inline-flex items-center gap-2"
            aria-keyshortcuts="/"
          >
            search
            <kbd
              class="hidden sm:inline-flex items-center justify-center w-5 h-5 text-xs bg-bg-muted border border-border rounded"
              aria-hidden="true"
            >
              /
            </kbd>
          </NuxtLink>
        </li>

        <!-- Packages dropdown (when connected) -->
        <li v-if="isConnected && npmUser" class="flex items-center">
          <HeaderPackagesDropdown :username="npmUser" />
        </li>

        <!-- Orgs dropdown (when connected) -->
        <li v-if="isConnected && npmUser" class="flex items-center">
          <HeaderOrgsDropdown :username="npmUser" />
        </li>
      </ul>

      <!-- Right: User status + GitHub -->
      <div class="flex-shrink-0 flex items-center gap-6">
        <ClientOnly>
          <SettingsMenu />
        </ClientOnly>

        <div v-if="showConnector">
          <ConnectorStatus />
        </div>

        <a
          href="https://github.com/npmx-dev/npmx.dev"
          target="_blank"
          rel="noopener noreferrer"
          class="link-subtle"
          aria-label="GitHub repository"
        >
          <span class="i-carbon-logo-github w-5 h-5" aria-hidden="true" />
        </a>
      </div>
    </nav>
  </header>
</template>
