<script setup lang="ts">
import type { FilterChip } from '#shared/types/preferences'

defineProps<{
  chips: FilterChip[]
}>()

const emit = defineEmits<{
  remove: [chip: FilterChip]
  clearAll: []
}>()
</script>

<template>
  <div v-if="chips.length > 0" class="flex flex-wrap items-center gap-2">
    <TransitionGroup name="chip">
      <span v-for="chip in chips" :key="chip.id" class="tag gap-1">
        <span class="text-fg-subtle text-xs">{{ chip.label }}:</span>
        <span class="max-w-32 truncate">{{
          Array.isArray(chip.value) ? chip.value.join(', ') : chip.value
        }}</span>
        <button
          type="button"
          class="ml-0.5 hover:text-fg rounded-full p-0.5 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
          :aria-label="$t('filters.remove_filter', { label: chip.label })"
          @click="emit('remove', chip)"
        >
          <span class="i-carbon-close w-3 h-3" aria-hidden="true" />
        </button>
      </span>
    </TransitionGroup>

    <button
      v-if="chips.length > 1"
      type="button"
      class="text-sm text-fg-subtle hover:text-fg underline transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2"
      @click="emit('clearAll')"
    >
      {{ $t('filters.clear_all') }}
    </button>
  </div>
</template>

<style scoped>
.chip-enter-active,
.chip-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.chip-move {
  transition: transform 0.2s ease;
}
</style>
