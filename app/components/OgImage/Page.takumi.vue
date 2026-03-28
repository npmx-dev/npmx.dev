<script setup lang="ts">
const { title, description } = defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <OgLayout>
    <div class="px-15 py-12 flex flex-col justify-center gap-12 h-full">
      <OgBrand :height="48" />

      <div class="flex flex-col max-w-full gap-3">
        <div
          class="lg:text-7xl text-5xl tracking-tighter font-mono leading-none"
          :style="{ lineClamp: 1, textOverflow: 'ellipsis' }"
        >
          {{ title }}
        </div>
      </div>

      <div
        v-if="description"
        class="pt-3 lg:text-4xl text-3xl opacity-70"
        :style="{ lineClamp: 2, textOverflow: 'ellipsis' }"
      >
        {{ description }}
      </div>
    </div>
  </OgLayout>
</template>
