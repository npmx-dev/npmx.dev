<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1"><strong>World Emoji Day</strong></p>
    </template>
    <img
      width="400"
      class="w-80 sm:w-140 max-w-full mx-auto"
      src="/extra/emoji.png"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
