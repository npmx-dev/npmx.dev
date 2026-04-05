<script setup lang="ts">
const props = defineProps<{
  src:
    | string
    | {
        dark: string
        light: string
      }
  alt: string
}>()
</script>
<template>
  <div v-if="typeof src === 'string'" class="h-full">
    <img :src="src" loading="lazy" height="36" class="w-auto block h-full" :alt="alt" />
  </div>
  <div v-else-if="src.light === 'auto'" class="h-full">
    <img
      :src="src.dark"
      loading="lazy"
      height="36"
      class="w-auto block light:invert light:grayscale h-full"
      :alt="alt"
    />
  </div>
  <div v-else class="h-full">
    <img
      :src="src.dark"
      loading="lazy"
      height="36"
      class="w-auto block light:hidden h-full"
      :alt="alt"
    />
    <img
      :src="src.light"
      loading="lazy"
      height="36"
      class="w-auto block hidden light:block h-full"
      :alt="alt"
    />
  </div>
</template>
