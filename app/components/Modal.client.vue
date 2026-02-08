<script setup lang="ts">
const props = defineProps<{
  modalTitle: string
}>()

const dialogRef = useTemplateRef('dialogRef')

const emit = defineEmits<{
  (e: 'transitioned'): void
}>()

const modalTitleId = computed(() => {
  const id = getCurrentInstance()?.attrs.id
  return id ? `${id}-title` : undefined
})

function handleModalClose() {
  dialogRef.value?.close()
}

/**
 * Emits `transitioned` once the dialog has finished its open opacity transition.
 * This is used by consumers that need to run layout-sensitive logic (for example
 * dispatching a resize) only after the modal is fully displayed.
 */
function onDialogTransitionEnd(event: TransitionEvent) {
  const el = dialogRef.value
  if (!el) return
  if (!el.open) return
  if (event.target !== el) return
  if (event.propertyName !== 'opacity') return
  emit('transitioned')
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
      class="w-[calc(100%-2rem)] bg-bg border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto overscroll-contain m-0 m-auto p-6 text-fg focus-visible:outline focus-visible:outline-accent/70"
      :aria-labelledby="modalTitleId"
      v-bind="$attrs"
      @transitionend="onDialogTransitionEnd"
    >
      <!-- Modal top header section -->
      <div class="flex items-center justify-between mb-6">
        <h2 :id="modalTitleId" class="font-mono text-lg font-medium">
          {{ modalTitle }}
        </h2>
        <ButtonBase
          type="button"
          :aria-label="$t('common.close')"
          @click="handleModalClose"
          classicon="i-carbon-close"
        />
      </div>
      <!-- Modal body content -->
      <slot />
    </dialog>
  </Teleport>
</template>

<style scoped>
/* Backdrop styling when any of the modals are open */
dialog:modal::backdrop {
  @apply bg-bg-elevated/70;
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
