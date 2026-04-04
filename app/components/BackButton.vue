<script setup lang="ts">
const router = useRouter()
const canGoBack = useCanGoBack()
</script>

<template>
  <button
    v-if="canGoBack"
    type="button"
    class="inline-flex items-center gap-2 p-1.5 -mx-1.5 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
    @click="router.back()"
  >
    <span class="i-lucide:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
    <span class="sr-only sm:not-sr-only">{{ $t('nav.back') }}</span>
  </button>
</template>
