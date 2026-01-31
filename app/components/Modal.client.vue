<script setup lang="ts">
defineProps<{
  modalTitle: string
}>()

function handleModalClose() {
  const modal = document.querySelector<HTMLDialogElement>('#modal')
  if (modal) {
    modal.close()
  }
}
</script>

<template>
  <Teleport to="body">
    <dialog
      class="w-full bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain m-0 m-auto p-6 text-white"
      v-bind="$attrs"
    >
      <!-- Modal top header section -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="font-mono text-lg font-medium">
          {{ modalTitle }}
        </h2>
        <button
          type="button"
          class="text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
          :aria-label="$t('common.close')"
          @click="handleModalClose"
        >
          <span class="i-carbon-close block w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <!-- Modal body content -->
      <slot></slot>
    </dialog>
  </Teleport>
</template>
