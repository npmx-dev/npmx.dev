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
</script>

<template>
  <header class="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-border">
    <nav aria-label="Main navigation" class="container h-14 flex items-center justify-between">
      <NuxtLink
        v-if="showLogo"
        to="/"
        aria-label="npmx home"
        class="header-logo font-mono text-lg font-medium text-fg hover:text-fg transition-colors duration-200 focus-ring rounded"
      >
        <span class="text-fg-subtle"><span style="letter-spacing: -0.2em">.</span>/</span>npmx
      </NuxtLink>
      <!-- Spacer when logo is hidden -->
      <span v-else class="w-1" />

      <ul class="flex items-center gap-4 sm:gap-6 list-none m-0 p-0">
        <li class="flex">
          <NuxtLink
            to="/search"
            class="link-subtle font-mono text-sm inline-flex items-center gap-2"
          >
            search
            <kbd
              class="hidden sm:inline-flex items-center justify-center w-5 h-5 text-xs bg-bg-muted border border-border rounded"
              >/</kbd
            >
          </NuxtLink>
        </li>
        <li v-if="showConnector" class="flex">
          <ConnectorStatus />
        </li>
        <li v-else class="flex">
          <a
            href="https://github.com/npmx-dev/npmx.dev"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-sm inline-flex items-center gap-1.5"
          >
            <span class="i-carbon-logo-github w-4 h-4" />
            <span class="hidden sm:inline">github</span>
          </a>
        </li>
      </ul>
    </nav>
  </header>
</template>
