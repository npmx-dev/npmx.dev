<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  version: string
  downloads?: string
  license?: string
}>(), {
  downloads: '',
  license: '',
})
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-center items-center bg-[#0a0a0a] text-[#fafafa]"
    style="font-family: 'Geist Mono'"
  >
    <h1 class="text-6xl font-medium tracking-tight">
      {{ name }}
    </h1>

    <div class="flex items-center gap-6 mt-6 text-xl text-[#666666]">
      <span>v{{ version }}</span>
      <span v-if="downloads">{{ downloads }}/wk</span>
      <span v-if="license">{{ license }}</span>
    </div>

    <p class="absolute bottom-12 text-lg text-[#404040]">
      npmx.dev
    </p>
  </div>
</template>
