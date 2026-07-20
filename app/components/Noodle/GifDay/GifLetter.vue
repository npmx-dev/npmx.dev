<script setup lang="ts">
const props = defineProps<{
  letter: string
  backgroundUrl: string
}>()

const cssUrl = computed<string>(() => `url(${props.backgroundUrl})`)
</script>

<template>
  <span
    :class="[
      'gif-letter-image',
      'font-noodle text-transparent line-height-[1] bg-clip-text bg-center bg-cover text-[8rem] md:text-[14rem] 2xl:text-[20rem] font-extrabold',
    ]"
  >
    {{ letter }}
  </span>
</template>

<style scoped>
.gif-letter-image {
  background-image: v-bind(cssUrl);
}
</style>
