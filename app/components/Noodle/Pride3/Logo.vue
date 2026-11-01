<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        Great places are built by diverse people
        <br />
        <strong>Happy Pride Month!</strong>
      </p>
    </template>
    <img
      width="400"
      class="mb-2 w-80 sm:w-140 max-w-full mx-auto"
      src="/extra/pride-3.png"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
