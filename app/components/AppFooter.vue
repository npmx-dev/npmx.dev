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
        <div class="hidden sm:flex items-center gap-6 min-h-11 text-xs">
          <LinkBase :to="{ name: 'about' }">
            {{ $t('footer.about') }}
          </LinkBase>
          <LinkBase :to="{ name: 'privacy' }">
            {{ $t('privacy_policy.title') }}
          </LinkBase>
          <LinkBase to="https://docs.npmx.dev">
            {{ $t('footer.docs') }}
          </LinkBase>
          <LinkBase to="https://repo.npmx.dev">
            {{ $t('footer.source') }}
          </LinkBase>
          <LinkBase to="https://social.npmx.dev">
            {{ $t('footer.social') }}
          </LinkBase>
          <LinkBase to="https://chat.npmx.dev">
            {{ $t('footer.chat') }}
          </LinkBase>
        </div>
      </div>
      <p class="text-xs text-fg-muted text-center sm:text-start m-0">
        <span class="sm:hidden">{{ $t('non_affiliation_disclaimer') }}</span>
        <span class="hidden sm:inline">{{ $t('trademark_disclaimer') }}</span>
      </p>
    </div>
  </footer>
</template>
