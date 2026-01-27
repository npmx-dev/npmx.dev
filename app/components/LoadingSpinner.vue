<script setup lang="ts">
defineProps<{
  /** Text to display next to the spinner */
  text?: string
}>()

const { t } = useI18n()
</script>

<template>
  <div aria-busy="true" class="flex items-center gap-3 text-fg-muted font-mono text-sm py-8">
    <span
      class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full motion-safe:animate-spin"
    />
    {{ text ?? t('common.loading') }}
  </div>
</template>
