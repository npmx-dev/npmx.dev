<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()

const { name: siteName } = useSiteConfig()
</script>

<template>
  <div
    data-theme="dark"
    class="flex w-full h-full items-center justify-center bg-bg text-fg font-sans"
  >
    <div class="absolute -top-10 force-left-12 size-[700px] rounded-full blur-3xl bg-fg/3" />

    <div class="p-15 flex flex-col gap-12">
      <div class="flex gap-4">
        <img
          src="/logo-icon.svg"
          width="60"
          height="60"
          alt="npmx logo"
          class="w-[60px] h-[60px]"
        />
        <h1 class="text-5xl tracking-tighter font-mono">{{ siteName }}</h1>
      </div>

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
  </div>
</template>
