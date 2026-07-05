<script setup lang="ts">
import Hls from 'hls.js'

const props = defineProps<{
  src: string
  autoplay?: boolean
}>()

const videoRef = useTemplateRef<HTMLVideoElement>('videoRef')

let hls: Hls | null = null

watch(
  [videoRef, () => props.src],
  ([video, src]) => {
    if (!video || !Hls.isSupported()) return

    hls?.destroy()
    hls = new Hls()
    hls.loadSource(src)
    hls.attachMedia(video)
    hls.on(Hls.Events.ERROR, err => {
      // oxlint-disable-next-line no-console
      console.log('video player failed', err)
    })
  },
  { immediate: true, flush: 'post' },
)

onScopeDispose(() => {
  hls?.destroy()
})

useIntersectionObserver(
  videoRef,
  ([entry]) => {
    const video = videoRef.value
    if (!props.autoplay || !video || !entry) return

    if (entry.isIntersecting) {
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  },
  { threshold: 0.5 },
)
</script>

<template>
  <video ref="videoRef" :src="src" />
</template>
