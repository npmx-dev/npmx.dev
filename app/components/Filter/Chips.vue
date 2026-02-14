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
      <TagStatic v-for="chip in chips" :key="chip.id" class="gap-2 pe-1">
        <span class="text-fg-subtle text-xs">{{ chip.label }}:</span>
        <span class="max-w-32 truncate">{{
          Array.isArray(chip.value) ? chip.value.join(', ') : chip.value
        }}</span>
        <ButtonBase
          :aria-label="$t('filters.remove_filter', { label: chip.label })"
          size="small"
          @click="emit('remove', chip)"
        >
          <span class="i-lucide:x w-3 h-3" aria-hidden="true" />
        </ButtonBase>
      </TagStatic>
    </TransitionGroup>

    <ButtonBase v-if="chips.length > 1" type="button" size="small" @click="emit('clearAll')">
      {{ $t('filters.clear_all') }}
    </ButtonBase>
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
