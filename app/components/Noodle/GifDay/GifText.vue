<script setup lang="ts">
const props = defineProps<{
  text: string
  backgroundUrl: string
  title?: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const style = computed(() => ({
  backgroundImage: `url(${props.backgroundUrl})`,
  backgroundPosition: props.backgroundPosition,
  backgroundSize: props.backgroundSize,
}))
</script>

<template>
  <span
    :title
    :style
    :class="[
      'font-noodle select-none leading-none bg-cover bg-center motion-safe:text-transparent bg-clip-text text-[4rem] @xl:text-[14rem] font-extrabold',
    ]"
  >
    {{ text }}
  </span>
</template>
