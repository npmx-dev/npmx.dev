<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    packages: string | string[]
    primaryColor?: string
  }>(),
  {
    packages: () => [],
    primaryColor: '#60a5fa',
  },
)

const ACCENT_COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24']

const displayPackages = computed(() => {
  const raw = props.packages
  const list = typeof raw === 'string'
    ? raw.split(',').map(p => p.trim()).filter(Boolean)
    : raw
  return list.slice(0, 4)
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
    style="font-family: 'Geist Mono', sans-serif"
  >
    <div class="relative z-10 flex flex-col gap-6">
      <!-- Icon + title row (same pattern as Default/Package) -->
      <div class="flex items-start gap-4">
        <div
          class="flex items-center justify-center w-16 h-16 p-3.5 rounded-xl shadow-lg bg-gradient-to-tr from-[#3b82f6]"
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
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="6" r="3" />
            <path d="M13 6h3a2 2 0 0 1 2 2v7" />
            <path d="M11 18H8a2 2 0 0 1-2-2V9" />
          </svg>
        </div>

        <h1 class="text-8xl font-bold">
          <span
            class="opacity-80 tracking-[-0.1em]"
            :style="{ color: primaryColor }"
            style="margin-left: -1rem; margin-right: 0.5rem"
          >./</span>compare
        </h1>
      </div>

      <!-- Package names as badges (same badge style as Default/Package) -->
      <div
        class="flex flex-wrap items-center gap-x-3 gap-y-3 text-4xl text-[#a3a3a3]"
        style="font-family: 'Geist', sans-serif"
      >
        <template v-for="(pkg, index) in displayPackages" :key="pkg">
          <span
            class="px-3 py-1 rounded-lg border font-normal"
            :style="{
              color: ACCENT_COLORS[index % ACCENT_COLORS.length],
              backgroundColor: ACCENT_COLORS[index % ACCENT_COLORS.length] + '10',
              borderColor: ACCENT_COLORS[index % ACCENT_COLORS.length] + '30',
              boxShadow: `0 0 20px ${ACCENT_COLORS[index % ACCENT_COLORS.length]}25`,
            }"
          >
            {{ pkg }}
          </span>
          <span v-if="index < displayPackages.length - 1">
            vs
          </span>
        </template>
      </div>
    </div>

    <div
      class="absolute -top-32 -inset-ie-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: primaryColor + '10' }"
    />
  </div>
</template>
