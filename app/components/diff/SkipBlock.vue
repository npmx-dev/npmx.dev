<script setup lang="ts">
defineProps<{
  count: number
  content?: string
}>()
</script>

<template>
  <!-- Spacer row -->
  <tr class="h-2" />

  <!-- Skip block row -->
  <tr class="h-10 font-mono bg-bg-muted text-fg-muted">
    <td />
    <td class="opacity-50 select-none text-center">
      <span class="i-lucide-chevrons-up-down w-4 h-4" />
    </td>
    <td>
      <span class="px-0 sticky left-2 italic opacity-50">
        {{ content || $t('compare.lines_hidden', { count }) }}
      </span>
    </td>
  </tr>

  <!-- Spacer row -->
  <tr class="h-2" />
</template>
