<template>
  <TooltipApp interactive position="top">
    <template #content>
      <p class="text-sm font-medium text-fg mb-1">
        We stand together. Always, everywhere, for all of us
        <br />
        <strong>Happy Pride Month!</strong>
      </p>
    </template>
    <img
      width="400"
      class="mb-2 w-80 sm:w-140 max-w-full mx-auto"
      src="/extra/pride-2.svg"
      :alt="$t('alt_logo')"
    />
  </TooltipApp>
</template>
