<script setup lang="ts">
defineProps<{
  title: string
  occasion?: string
  poster?: string
  backdrop?: string
}>()

// Aspect-locked dimensions for the inline npmx wordmark (height × 602/170).
const BRAND_HEIGHT = 40
const BRAND_WIDTH = 142
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex items-center gap-12 h-full">
      <div class="flex-1 flex flex-col justify-center gap-6 min-w-0">
        <img
          src="/logo.svg"
          alt="npmx"
          :width="BRAND_WIDTH"
          :height="BRAND_HEIGHT"
          :style="{ width: `${BRAND_WIDTH}px`, height: `${BRAND_HEIGHT}px` }"
        />
        <div
          class="text-6xl tracking-tighter font-mono leading-tight"
          :style="{ lineClamp: 2, textOverflow: 'ellipsis' }"
        >
          {{ title }}
        </div>
        <div
          v-if="occasion"
          class="text-2xl opacity-70 leading-snug"
          :style="{ lineClamp: 3, textOverflow: 'ellipsis' }"
        >
          {{ occasion }}
        </div>
      </div>

      <div
        v-if="poster"
        class="shrink-0 relative flex items-center justify-center overflow-hidden"
        :style="{ width: '360px', height: '360px' }"
      >
        <img
          v-if="backdrop"
          :src="backdrop"
          alt=""
          :style="{
            position: 'absolute',
            left: '0',
            right: '0',
            bottom: '0',
            width: '100%',
            height: 'auto',
            objectFit: 'cover',
          }"
        />
        <img
          :src="poster"
          alt=""
          :style="{
            position: 'relative',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }"
        />
      </div>
    </div>
  </OgLayout>
</template>
