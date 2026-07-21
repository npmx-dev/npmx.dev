<script setup lang="ts">
const props = defineProps<{
  text: string
  backgroundUrl: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const cssUrl = computed<string>(() => `url(${props.backgroundUrl})`)
</script>

<template>
  <span
    :class="[
      'gif-text-image',
      'font-noodle leading-none bg-cover bg-center text-transparent bg-clip-text text-[8rem] md:text-[14rem] 2xl:text-[20rem] font-extrabold',
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
