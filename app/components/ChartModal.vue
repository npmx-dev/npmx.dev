<script setup lang="ts"></script>

<template>
  <Modal
    :modalTitle="$t('package.downloads.modal_title')"
    id="chart-modal"
    class="h-full sm:h-min sm:border sm:border-border sm:rounded-lg shadow-xl sm:max-h-[90vh] sm:max-w-3xl"
  >
    <div class="font-mono text-sm">
      <slot />
    </div>
    <slot name="after" />
  </Modal>
</template>
