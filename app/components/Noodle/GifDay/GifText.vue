<script setup lang="ts">
const props = defineProps<{
  text: string
  backgroundUrl: string
  title?: string
  backgroundPosition?: string
  backgroundSize?: string
}>()

const loaded = ref(false)
const random = useState(`gif-text-rotate-${useId()}`, () => Math.random())
const rotateFrom = computed(() => (random.value < 0.5 ? '-rotate-20' : 'rotate-20'))

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
    :class="[
      'inline-block motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none',
      loaded
        ? 'opacity-100 scale-100 translate-y-0 rotate-0'
        : `opacity-0 scale-85 translate-y-[20%] ${rotateFrom}`,
    ]"
  >
    <span
      :title
      :style
      :class="[
        'font-noodle select-none leading-none bg-cover bg-center motion-safe:text-transparent bg-clip-text text-[4rem] @xl:text-[14rem] font-extrabold transition-all duration-300',
      ]"
    >
      {{ text }}
    </span>
  </span>
</template>
