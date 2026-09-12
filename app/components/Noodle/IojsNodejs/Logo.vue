<script setup lang="ts">
defineProps<{
  // Render the bare logo without the tooltip wrapper. Used on the /noodles
  // archive + detail pages where the same content lives in the right panel.
  noTooltip?: boolean
}>()
</script>

<template>
  <ColorSchemeImg
    v-if="noTooltip"
    width="400"
    class="motion-safe:animate-fade-in motion-safe:animate-scale-in relative z-10 w-full"
    dark-src="/extra/iojs-nodejs-dark.png"
    light-src="/extra/iojs-nodejs.png"
    :alt="$t('alt_logo')"
  />
  <TooltipApp
    v-else
    interactive
    :tooltip-attr="{ class: 'w-[calc(100%-2rem)]! max-w-sm!' }"
    class="mb-2"
  >
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        <span class="text-fg-subtle">
          14 September 2015 - IO.js and Node.js merge
          <br />
          <a
            href="https://nodejs.org/en/blog/announcements/foundation-v4-announce"
            target="_blank"
            rel="noopener noreferrer"
            class="underline"
            >Node.js Foundation Combines Node.js and io.js Into Single Codebase</a
          >
        </span>
      </p>
    </template>
    <ColorSchemeImg
      width="400"
      class="motion-safe:animate-fade-in motion-safe:animate-scale-in w-80 sm:w-120"
      dark-src="/extra/iojs-nodejs-dark.png"
      light-src="/extra/iojs-nodejs.png"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
