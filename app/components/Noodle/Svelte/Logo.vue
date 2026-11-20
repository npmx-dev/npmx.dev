<script setup lang="ts">
defineProps<{
  noTooltip?: boolean
}>()
</script>

<template>
  <NoodleSvelteArt v-if="noTooltip" class="mx-auto w-full h-auto max-w-full" />
  <TooltipApp
    v-else
    interactive
    :tooltip-attr="{ class: 'w-[calc(100%-2rem)]! max-w-sm!' }"
    class="mb-2"
  >
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        <span class="text-fg-subtle">
          29 November 2016 - Svelte v1 is released
          <br />
          <a
            href="https://svelte.dev/blog/frameworks-without-the-framework"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
            >Frameworks without the framework</a
          >
        </span>
      </p>
    </template>
    <NoodleSvelteArt class="mx-auto w-80 sm:w-140 h-auto max-w-full" />
  </TooltipApp>
</template>
