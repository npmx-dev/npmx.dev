<script setup lang="ts">
import { getAnnotatorIcon, getAnnotatorStyle, type AnnotatorSlotName } from '~/utils/charts'

const props = defineProps<{
  slotName: AnnotatorSlotName
  slotProps?: unknown
}>()

const icon = computed(() => getAnnotatorIcon(props.slotName, props.slotProps))
const style = computed(() => getAnnotatorStyle(props.slotName, props.slotProps))
</script>

<template>
  <span
    v-if="icon"
    class="w-6 h-6"
    :class="[icon, slotName === 'annotator-action-color' ? null : 'text-fg-subtle']"
    :style="style"
    aria-hidden="true"
  />
</template>
