<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    open.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 bg-black/60 cursor-default"
          aria-label="Close modal"
          @click="open = false"
        />

        <div
          class="relative w-full h-full sm:h-auto bg-bg sm:border sm:border-border sm:rounded-lg shadow-xl sm:max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-3xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="chart-modal-title"
        >
          <div class="p-4 sm:p-6">
            <div class="flex items-center justify-between mb-4 sm:mb-6">
              <h2 id="chart-modal-title" class="font-mono text-lg font-medium">
                <slot name="title" />
              </h2>
              <button
                type="button"
                class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                aria-label="Close"
                @click="open = false"
              >
                <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div class="font-mono text-sm">
              <slot />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
