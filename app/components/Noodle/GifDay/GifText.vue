<script setup lang="ts">
const props = defineProps<{
  text: string
  backgroundUrl: string
  title?: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const cssUrl = computed<string>(() => `url(${props.backgroundUrl})`)
</script>

<template>
  <span
    :title
    :class="[
      'gif-text-image',
      'font-noodle leading-none bg-cover bg-center motion-safe:text-transparent bg-clip-text text-[4rem] @xl:text-[14rem] font-extrabold',
    ]"
    :style="{ backgroundPosition, backgroundSize }"
  >
    {{ text }}
  </span>
</template>

<style scoped>
.gif-text-image {
  background-image: v-bind(cssUrl);
}
</style>
