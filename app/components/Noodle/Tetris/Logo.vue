<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        <strong>World Tetris Day</strong>. The legendary console turns 42.
        <br />
        <i>Yes, you matched the blocks correctly, but polyominos are cool too!</i>
      </p>
    </template>
    <img
      width="400"
      class="mb-10 w-80 sm:w-140 max-w-full mx-auto"
      src="/extra/tetris.svg"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
