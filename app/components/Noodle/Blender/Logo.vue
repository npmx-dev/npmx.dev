<script setup lang="ts">
defineProps<{
  // Render the bare logo without the tooltip wrapper. Used on the /noodles
  // archive + detail pages where the same content lives in the right panel.
  noTooltip?: boolean
}>()
</script>

<template>
  <NoodleBlenderArt v-if="noTooltip" class="mx-auto w-full h-auto max-w-full" />
  <TooltipApp
    v-else
    interactive
    :tooltip-attr="{ class: 'w-[calc(100%-2rem)]! max-w-sm!' }"
    class="mb-2"
  >
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        <span class="text-fg-subtle">
          13 October 2002 - Blender becomes free and open source
          <br />
          <a
            href="https://www.blender.org/about/history/"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
            >Blender's History</a
          >
        </span>
      </p>
    </template>
    <NoodleBlenderArt class="mx-auto w-80 sm:w-140 h-auto max-w-full" />
  </TooltipApp>
</template>
