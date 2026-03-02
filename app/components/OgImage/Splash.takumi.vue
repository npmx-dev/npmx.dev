<script setup lang="ts">
const { name, description } = useSiteConfig()
</script>

<template>
  <div
    data-theme="dark"
    class="px-20 flex w-full h-full items-center justify-center bg-bg text-fg font-sans"
  >
    <div class="absolute -top-10 force-left-12 size-[700px] rounded-full blur-3xl bg-fg/3" />

    <div class="flex flex-col">
      <div class="flex items-center gap-4">
        <img
          src="/logo-icon.svg"
          width="100"
          height="100"
          alt="npmx logo"
          class="w-[100px] h-[100px]"
        />
        <h1 class="text-8xl pb-3 font-mono">{{ name }}</h1>
      </div>
      <div class="text-4xl text-fg-muted gap-3">
        {{ description }}
      </div>
    </div>
  </div>
</template>
