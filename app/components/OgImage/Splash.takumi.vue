<script setup lang="ts">
const { description } = useSiteConfig()
</script>

<template>
  <OgLayout>
    <div class="flex w-full h-full items-center justify-center px-20">
      <div class="flex flex-col gap-6">
        <OgBrand :height="80" />
        <div class="text-4xl text-fg-muted">
          {{ description }}
        </div>
      </div>
    </div>
  </OgLayout>
</template>
