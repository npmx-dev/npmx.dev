<template>
  <Transition name="pwa-toast" appear>
    <div
      v-if="$pwa?.needRefresh"
      role="alert"
      aria-live="polite"
      class="fixed bottom-4 inset-ie-4 z-50 flex items-start gap-3 px-4 py-3 bg-bg border border-border rounded-lg shadow-lg max-w-sm"
    >
      <span class="i-lucide:refresh-cw w-4 h-4 text-fg-muted shrink-0 mt-0.5" aria-hidden="true" />
      <p class="text-sm text-fg flex-1">{{ $t('pwa.update_available') }}</p>
      <div class="flex items-center gap-2 shrink-0">
        <ButtonBase size="sm" @click="$pwa?.cancelPrompt()">
          {{ $t('common.close') }}
        </ButtonBase>
        <ButtonBase size="sm" variant="primary" @click="$pwa?.updateServiceWorker()">
          {{ $t('pwa.refresh') }}
        </ButtonBase>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-toast-enter-active,
.pwa-toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}

.pwa-toast-enter-from,
.pwa-toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
