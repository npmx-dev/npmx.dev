<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    version: string
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
      </div>
    </div>

    <div
      class="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
