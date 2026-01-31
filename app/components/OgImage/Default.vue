<script setup lang="ts">
interface Props {
  primaryColor?: string
  title?: string
  description?: string
}

const props = withDefaults(defineProps<Props>(), {
  primaryColor: '#60a5fa',
  title: 'npmx',
  description: 'A better browser for the **npm registry**',
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center px-20 bg-[#050505] text-[#fafafa] relative overflow-hidden"
  >
    <div class="relative z-10 flex flex-col gap-6">
      <div class="flex items-start gap-4">
        <div
          class="flex items-start justify-center w-16 h-16 rounded-xl bg-gradient-to-tr from-[#3b82f6] shadow-lg"
          :style="{ backgroundColor: props.primaryColor }"
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
          <span class="opacity-80" :style="{ color: props.primaryColor }">./</span>{{ props.title }}
        </h1>
      </div>

      <div
        class="flex flex-wrap items-center gap-x-3 text-4xl font-light text-[#a3a3a3]"
        style="font-family: 'Geist Sans', sans-serif"
      >
        <template v-for="(part, index) in props.description.split(/(\*\*.*?\*\*)/)" :key="index">
          <span
            v-if="part.startsWith('**') && part.endsWith('**')"
            class="px-3 py-1 rounded-lg border font-normal"
            :style="{
              color: props.primaryColor,
              backgroundColor: props.primaryColor + '10',
              borderColor: props.primaryColor + '30',
              boxShadow: `0 0 20px ${props.primaryColor}25`,
            }"
          >
            {{ part.replaceAll('**', '') }}
          </span>
          <span v-else-if="part.trim() !== ''">
            {{ part }}
          </span>
        </template>
      </div>
    </div>

    <div
      class="absolute -top-32 -right-32 w-[550px] h-[550px] rounded-full blur-3xl"
      :style="{ backgroundColor: props.primaryColor + '10' }"
    />
  </div>
</template>
