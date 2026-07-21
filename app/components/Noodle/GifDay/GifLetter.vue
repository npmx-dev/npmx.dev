<script setup lang="ts">
const props = defineProps<{
  letter: string
  backgroundUrl: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const cssUrl = computed<string>(() => `url(${props.backgroundUrl})`)
</script>

<template>
  <span
    :class="[
      'gif-letter-image',
      'font-noodle leading-none bg-cover bg-center text-transparent bg-clip-text text-[8rem] md:text-[14rem] 2xl:text-[20rem] font-extrabold',
    ]"
    :style="{ backgroundPosition, backgroundSize }"
  >
    {{ letter }}
  </span>
</template>

<style scoped>
.gif-letter-image {
  background-image: v-bind(cssUrl);
}
</style>
