<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const dialogRef = useTemplateRef('dialogRef')

watch(open, isOpen => {
  if (isOpen) {
    dialogRef.value?.showModal()
  } else {
    dialogRef.value?.close()
  }
})

function handleDialogClose() {
  open.value = false
}

function handleBackdropClick(event: MouseEvent) {
  // Close when clicking the backdrop (the dialog element itself, not its contents)
  if (event.target === dialogRef.value) {
    open.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="bg-transparent backdrop:bg-black/60 max-w-3xl w-full p-4 m-auto"
      aria-labelledby="chart-modal-title"
      @close="handleDialogClose"
      @click="handleBackdropClick"
    >
      <div
        class="bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
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
          <div class="flex items-center font-mono text-sm">
            <slot />
          </div>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog::backdrop {
  background: rgba(0, 0, 0, 0.6);
}

dialog[open] {
  animation: fade-in 200ms ease-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
