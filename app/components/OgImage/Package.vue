<script setup lang="ts">
import { computed, toRefs } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    version: string
    stars: number
    downloads?: string
    license?: string
    primaryColor?: string
  }>(),
  {
    downloads: '',
    license: '',
    primaryColor: '#60a5fa',
  },
)

const { name, version, stars, downloads, license, primaryColor } = toRefs(props)

const formattedStars = computed(() =>
  Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(stars.value),
)
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
  >
    <div class="relative z-10 flex flex-col gap-6">
      <div class="flex items-start gap-4">
        <div
          class="flex items-start justify-center w-16 h-16 rounded-xl shadow-lg bg-gradient-to-tr from-[#3b82f6]"
          :style="{ backgroundColor: primaryColor }"
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m7.5 4.27 9 5.15" />
            <path
              d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
            />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
        </div>

        <h1
          class="text-8xl font-bold tracking-tighter"
          style="font-family: 'Geist Sans', sans-serif"
        >
          <span :style="{ color: primaryColor }" class="opacity-80">./</span>{{ name }}
        </h1>
      </div>

      <div
        class="flex items-center gap-3 text-4xl font-light text-[#a3a3a3]"
        style="font-family: 'Geist Sans', sans-serif"
      >
        <span
          class="px-3 py-1 rounded-lg border"
          :style="{
            color: primaryColor,
            backgroundColor: primaryColor + '10',
            borderColor: primaryColor + '30',
            boxShadow: `0 0 20px ${primaryColor}25`,
          }"
        >
          {{ version }}
        </span>
        <span v-if="downloads">
          <span>• {{ downloads }} </span>
          <span class="flex items-center gap-0">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-white/70"
            >
              <circle cx="12" cy="12" r="10" class="opacity-40" />
              <path d="M12 8v8m-3-3l3 3 3-3" />
            </svg>
            <span>/wk</span>
          </span>
        </span>
        <span v-if="license"> • {{ license }}</span>
        <span class="flex items-center gap-2">
          <span>•</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32px" height="32px">
            <path
              fill="currentColor"
              d="m16 6.52l2.76 5.58l.46 1l1 .15l6.16.89l-4.38 4.3l-.75.73l.18 1l1.05 6.13l-5.51-2.89L16 23l-.93.49l-5.51 2.85l1-6.13l.18-1l-.74-.77l-4.42-4.35l6.16-.89l1-.15l.46-1zM16 2l-4.55 9.22l-10.17 1.47l7.36 7.18L6.9 30l9.1-4.78L25.1 30l-1.74-10.13l7.36-7.17l-10.17-1.48Z"
            />
          </svg>
          <span>
            {{ formattedStars }}
          </span>
        </span>
      </div>
    </div>

    <div
      class="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
