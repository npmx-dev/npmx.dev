<script setup lang="ts">
withDefaults(
  defineProps<{
    /** Hide the "manage in settings" link (e.g. on the settings page itself) */
    showSettingsLink?: boolean
  }>(),
  {
    showSettingsLink: true,
  },
)
</script>

<template>
  <div
    role="alert"
    class="rounded-lg border border-red-700 dark:border-red-400 bg-red-400/10 px-4 py-3 text-red-700 dark:text-red-400"
  >
    <p class="m-0 flex items-center gap-2 font-mono text-sm font-medium">
      <span class="i-lucide:triangle-alert w-4 h-4 shrink-0" aria-hidden="true" />
      {{ $t('security_sources.none_enabled') }}
    </p>
    <p class="mt-2 mb-0 text-sm">
      {{ $t('security_sources.none_enabled_detail') }}
      <NuxtLink
        v-if="showSettingsLink"
        to="/settings"
        class="underline underline-offset-4 decoration-red-600/60 dark:decoration-red-400/50 hover:decoration-fg focus-visible:decoration-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 transition-colors"
      >
        {{ $t('security_sources.manage_in_settings') }}
      </NuxtLink>
    </p>
  </div>
</template>
