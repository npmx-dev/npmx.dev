<script setup lang="ts">
const props = defineProps<{
  lightSrc: string
  darkSrc: string
}>()
</script>

<template>
  <img
    :src="props.darkSrc"
    class="color-mode-img"
    :style="`--light-src: url('${props.lightSrc}')`"
  />
</template>

<style>
.light .color-mode-img {
  content: var(--light-src);
}
</style>
