<script setup lang="ts">
const route = useRoute()
const isHome = computed(() => route.name === 'index')
</script>

<template>
  <footer class="border-t border-border mt-auto">
    <div class="container py-3 sm:py-8 flex flex-col gap-2 sm:gap-4 text-fg-subtle text-sm">
      <div
        class="flex flex-col sm:flex-row sm:flex-wrap items-center sm:items-baseline justify-between gap-2 sm:gap-4"
      >
        <div>
          <p class="font-mono text-balance m-0 hidden sm:block">{{ $t('tagline') }}</p>
          <BuildEnvironment v-if="!isHome" footer />
        </div>
        <!-- Desktop: Show all links. Mobile: Links are in MobileMenu -->
        <div class="hidden sm:flex items-center gap-6">
          <NuxtLink to="/about" class="link-subtle font-mono text-xs flex items-center">
            {{ $t('footer.about') }}
          </NuxtLink>
          <a
            href="https://docs.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs flex items-center gap-1"
          >
            {{ $t('footer.docs') }}
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://repo.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs flex items-center gap-1"
          >
            {{ $t('footer.source') }}
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://social.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs flex items-center gap-1"
          >
            {{ $t('footer.social') }}
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href="https://chat.npmx.dev"
            target="_blank"
            rel="noopener noreferrer"
            class="link-subtle font-mono text-xs flex items-center gap-1"
          >
            {{ $t('footer.chat') }}
            <span class="i-carbon:launch rtl-flip w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-start m-0">
        <span class="sm:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden sm:inline">{{ $t('trademark_disclaimer') }}</span>
      </p>
    </div>
  </footer>
</template>
