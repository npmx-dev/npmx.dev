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
    <img
      :src="src"
      loading="lazy"
      height="36"
      class="h-full w-full object-contain block"
      :alt="alt"
    />
  </div>
  <div v-else-if="src.light === 'auto'" class="h-full">
    <img
      :src="src.dark"
      loading="lazy"
      height="36"
      class="h-full w-full object-contain block light:invert light:grayscale"
      :alt="alt"
    />
  </div>
  <div v-else class="h-full">
    <img
      :src="src.dark"
      loading="lazy"
      height="36"
      class="h-full w-full object-contain block light:hidden"
      :alt="alt"
    />
    <img
      :src="src.light"
      loading="lazy"
      height="36"
      class="h-full w-full object-contain block hidden light:block"
      :alt="alt"
    />
  </div>
</template>
