<template>
  <div ref="sizer" class="sizer w-full sm:w-[540px] md:w-[640px] lg:w-[900px]"></div>
</template>

<style>
.sizer {
  position: relative;
  height: auto;
  aspect-ratio: 900/360;
}
</style>

<script setup lang="ts">
import { init } from './emoji-thing'
import { onMounted, onUnmounted, useTemplateRef } from 'vue'

const props = defineProps<{
  emojiSets: Record<string, string>
}>()

let emojiSetImagesPromise: undefined | Promise<Record<string, HTMLImageElement>>

function loadEmojiSetImages() {
  if (emojiSetImagesPromise) {
    return emojiSetImagesPromise
  }

  const promise = Promise.all(
    Object.entries(props.emojiSets).map(([name, src]) => {
      return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
        const image = new Image()
        image.addEventListener('load', () => {
          resolve([name, image])
        })
        image.addEventListener('error', () => {
          if (promise === emojiSetImagesPromise) {
            emojiSetImagesPromise = undefined
          }
          reject(new Error(`could not load image ${JSON.stringify(src)}`))
        })
        image.src = src
      })
    }),
  ).then(sets => Object.fromEntries(sets))

  emojiSetImagesPromise = promise
  return emojiSetImagesPromise
}

let running = false
let handle: undefined | ReturnType<typeof init>
let observer: undefined | IntersectionObserver

const sizerRef = useTemplateRef<HTMLDivElement>('sizer')

onMounted(() => {
  const sizer = sizerRef.value
  if (!sizer) {
    return
  }

  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) {
        return
      }

      if (entry.isIntersecting) {
        running = true
        loadEmojiSetImages().then(sets => {
          if (!running) {
            return
          }
          if (!handle) {
            handle = init(sizer, sets)
          }
          handle.start()
        })
      } else {
        running = false
        handle?.pause()
      }
    },
    {
      rootMargin: '100px',
    },
  )
  observer.observe(sizer)
})

onUnmounted(() => {
  handle?.destroy()
  handle = undefined

  observer?.disconnect()
  observer = undefined

  running = false
})
</script>
