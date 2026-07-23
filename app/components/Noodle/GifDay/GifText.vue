<script setup lang="ts">
const props = defineProps<{
  text: string
  backgroundUrl: string
  title?: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const loaded = ref(false)

onMounted(() => {
  const image = new Image()
  image.addEventListener('load', () => {
    loaded.value = true
  })
  image.src = props.backgroundUrl
})

const style = computed(() => ({
  backgroundImage: loaded.value ? `url(${props.backgroundUrl})` : undefined,
  backgroundPosition: props.backgroundPosition,
  backgroundSize: props.backgroundSize,
}))
</script>

<template>
  <span
    :title
    :style
    :class="[
      'font-noodle select-none leading-none bg-cover bg-center motion-safe:text-transparent bg-clip-text text-[4rem] @xl:text-[14rem] font-extrabold transition-[background-image] duration-300',
      !loaded && 'bg-fg-muted/20 animate-pulse',
    ]"
  >
    {{ text }}
  </span>
</template>
