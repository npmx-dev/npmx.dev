<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    height?: number
  }>(),
  {
    height: 60,
  },
)

const width = computed(() => Math.round(props.height * (602 / 170)))
</script>

<template>
  <img
    src="/logo.svg"
    alt="npmx"
    :width="width"
    :height="height"
    :style="{ width: `${width}px`, height: `${height}px` }"
  />
</template>
