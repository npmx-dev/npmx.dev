<script setup lang="ts">
const props = defineProps<{
  modalTitle?: string
}>()

const emit = defineEmits<{
  (e: 'transitioned'): void
}>()
</script>

<template>
  <Modal
    :modalTitle="modalTitle ?? $t('package.trends.title')"
    id="chart-modal"
    class="h-full sm:h-min sm:border sm:border-border sm:rounded-lg shadow-xl sm:max-h-[90vh] sm:max-w-3xl"
    @transitioned="emit('transitioned')"
  >
    <div class="font-mono text-sm">
      <slot />
    </div>
    <slot name="after" />
  </Modal>
</template>
