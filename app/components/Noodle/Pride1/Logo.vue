<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">Happy Pride Month!</p>
    </template>
    <img
      width="400"
      class="mb-6 w-80 sm:w-140 max-w-full"
      src="/extra/pride-1.svg"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
