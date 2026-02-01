<script setup lang="ts">
const props = defineProps<{
  modalTitle: string
}>()

const dialogRef = ref<HTMLDialogElement>()

const modalTitleId = computed(() => {
  const id = getCurrentInstance()?.attrs.id
  return id ? `${id}-title` : undefined
})

function handleModalClose() {
  dialogRef.value?.close()
}

defineExpose({
  showModal: () => dialogRef.value?.showModal(),
  close: () => dialogRef.value?.close(),
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      closedby="any"
      class="w-full bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain m-0 m-auto p-6 text-white"
      :aria-labelledby="modalTitleId"
      v-bind="$attrs"
    >
      <!-- Modal top header section -->
      <div class="flex items-center justify-between mb-6">
        <h2 :id="modalTitleId" class="font-mono text-lg font-medium">
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
      <slot />
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Backdrop styling when any of the modals are open */
dialog:modal::backdrop {
  @apply bg-black/60;
}

dialog::backdrop {
  pointer-events: none;
}

/* Modal transition styles */
dialog {
  opacity: 0;
  transition: opacity 200ms ease;
  transition-behavior: allow-discrete;
}

dialog:modal {
  opacity: 1;
  transition: opacity 200ms ease;
  transition-behavior: allow-discrete;
}

@starting-style {
  dialog:modal {
    opacity: 0;
  }
}
</style>
